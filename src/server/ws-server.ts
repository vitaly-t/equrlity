import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes'
import * as Rpc from '../lib/rpc';
import * as SrvrMsg from '../lib/serverMessages';

import * as Cache from './cache';
import * as Jwt from './jwt';
import * as Pg from './pgsql';

type CacheSub = { ws: any, sub: Cache.Subscription }
let _socketSubs: CacheSub[] = [];
let _userNames: Map<Dbt.userId, Dbt.userName>;
let _userSockets = new Map<Dbt.userId, any[]>();
let _sockets = new Map<string, any>();

const interval = setInterval(() => {
  _socketSubs.forEach(({ ws, sub }) => {
    if (!ws.isAlive) ws.terminate();
    if (ws.readyState !== 1) {
      Cache.unSubscribe(sub);
      if (_userSockets.has(ws.userId)) {
        let wss = _userSockets.get(ws.userId);
        let i = wss.indexOf(ws);
        if (i >= 0) wss.splice(i, 1);
      }
    }
  });
  _socketSubs = _socketSubs.filter(({ ws, sub }) => ws.readyState === 1);
  _socketSubs.forEach(({ ws, sub }) => {
    ws.isAlive = false;
    ws.ping('', false, true);
  });
}, 60000);

export async function sendMessagesToUser(userId: Dbt.userId, messages: SrvrMsg.MessageItem[]) {
  if (!_userSockets.has(userId)) return;
  let wss = _userSockets.get(userId);
  wss.forEach(ws => sendMessages(ws, userId, messages));
}

export async function sendMessagesToConnection(pk: string, userId: Dbt.userId, messages: SrvrMsg.MessageItem[]) {
  if (!_sockets.has(pk)) return;
  sendMessages(_sockets.get(pk), userId, messages);
}

async function sendMessages(ws: any, userId: Dbt.userId, messages: SrvrMsg.MessageItem[], last_feed?: Date) {
  try {
    let user = Cache.users.get(userId);
    let savUser = false;
    if (last_feed && last_feed > user.last_feed) {
      user = { ...user, last_feed };
      savUser = true;
    }
    messages.push({ type: "User", message: user });
    let srvmsg: SrvrMsg.ServerMessage = { messages };
    ws.send(JSON.stringify(srvmsg));
    if (savUser) {
      user = await Pg.updateRecord<Dbt.User>("users", user);
      Cache.touchUser(user);
    }
  }
  catch (e) {
    ws.isAlive = false;
    console.log("send error: " + e.message);
    return;
  }
}

async function initConnection(ws: any, message: string) {
  let req = JSON.parse(message);
  if (req.ping) {
    ws.send('{"pong": true}');
    return;
  }
  if (req.type !== "Init") {
    console.log("Invalid message - expecting Init but got :" + message);
    return;
  }

  let token = req.jwt;
  let userJwt = Jwt.verifyJwt(token);
  let user: Dbt.User = Cache.users.get(userJwt.id);
  if (!user) throw new Error("Invalid user id");
  //ws.userName = user.userName;  // debugging only - not currently maintained
  ws.userId = user.userId;
  if (!_userSockets.has(user.userId)) _userSockets.set(user.userId, [ws]);
  else _userSockets.get(user.userId).push(ws);
  let pk = JSON.stringify(userJwt.publicKey);
  if (_sockets.has(pk)) {
    let tws = _sockets.get(pk);
    tws.isActive = false;
  }
  _sockets.set(pk, ws);

  _userNames = Cache.userIdNames();
  let now = new Date();
  let last_feed = req.last_feed ? new Date(req.last_feed) : user.last_feed;
  let result: Rpc.InitializeResponse = await Pg.getInitialData(user, last_feed);

  let msg: SrvrMsg.MessageItem = { type: "Init", message: result };
  let msgs = [msg];
  req.contentIds.filter(id => !Cache.contents.has(id)).forEach(contentId => {
    let updt: SrvrMsg.MessageItem = { type: "Content", message: { contentId }, remove: true };
    msgs.push(updt);
  });
  req.linkIds.filter(id => !Cache.links.has(id)).forEach(linkId => {
    let updt: SrvrMsg.MessageItem = { type: "Link", message: { linkId }, remove: true };
    msgs.push(updt);
  });

  sendMessages(ws, user.userId, msgs, now)

  let sub: Cache.Subscription;
  sub = {
    filter: u => true,
    send: async (updts, now) => {
      try {
        if (ws.readyState !== 1) throw new Error("Websocket not ready");
        let messages: SrvrMsg.MessageItem[] = [];
        let sendUser = false;
        let filtrd = updts.filter(u => (u.table === "tags") || (u.table === "users") || (u.record.userId && u.record.userId === user.userId))
        for (const updt of filtrd) {
          let msg: SrvrMsg.MessageItem;
          switch (updt.table) {
            case "users": {
              let id = updt.record.userId;
              if (id === user.userId) sendUser = true;
              else {
                let name = _userNames.get(id);
                let u = Cache.users.get(id)
                if (name && u && u.userName !== name) msg = { type: "UserIdName", message: { id, name } };
              }
              break;
            }
            case "contents": {
              msg = { type: "Content", message: updt.record };
              break;
            }
            case "tags": {
              msg = { type: "Tag", message: updt.record };
              break;
            }
            case "links": {
              let link: Dbt.Link = updt.record;
              let message = updt.remove ? { link, linkDepth: 0, viewCount: 0, promotionsCount: 0, deliveriesCount: 0 } : await Pg.getUserLinkItem(link.linkId);
              msg = { type: "Link", message };
              break;
            }
          }
          if (msg) {
            if (updt.remove) msg.remove = true;
            messages.push(msg);
          }
        };

        let feeds = await Pg.liveUserFeed(user.userId, updts)
        feeds.forEach(message => messages.push({ type: "Feed", message }));
        if (sendUser || messages.length > 0) sendMessages(ws, user.userId, messages, now)
      }
      catch (e) {
        console.log("Error handling subscription updates: " + e.message);
      }
    }
  };
  Cache.subscribe(sub);
  _socketSubs.push({ ws, sub });
}

export async function server(ctx) {
  let ws = ctx.websocket;
  ws.on('message', message => {
    try { initConnection(ws, message); }
    catch (e) { console.log("Error establishing connection: " + e.message); }
  });
}
