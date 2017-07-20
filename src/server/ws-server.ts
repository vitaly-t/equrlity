import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes'
import * as Rpc from '../lib/rpc';
import * as SrvrMsg from '../lib/serverMessages';

import * as cache from './cache';
import * as jwt from './jwt';
import * as pg from './pgsql';

type CacheSub = { ws: any, sub: cache.Subscription }
let _socketSubs: CacheSub[] = [];

const interval = setInterval(() => {
  _socketSubs.forEach(({ ws, sub }) => {
    if (ws.isAlive === false) {
      ws.terminate();
      cache.unSubscribe(sub);
    }
  });
  _socketSubs = _socketSubs.filter(({ ws, sub }) => ws.isAlive);
  _socketSubs.forEach(({ ws, sub }) => {
    ws.isAlive = false;
    ws.ping('', false, true);
  });
}, 60000);

export async function server(ctx) {
  let ws = ctx.websocket;

  async function sendMessages(userId: Dbt.userId, messages: SrvrMsg.MessageItem[], last_feed?: Date) {
    let user = cache.users.get(userId);
    let email = jwt.getUserJwt(userId).email;
    last_feed = last_feed || new Date();
    let timeStamp = last_feed.toISOString();
    let headers: SrvrMsg.MessageHeaders = { credits: user.credits, moniker: user.userName, email, homePage: user.home_page, timeStamp };
    let srvmsg: SrvrMsg.ServerMessage = { headers, messages };
    try { ws.send(JSON.stringify(srvmsg)); }
    catch (e) {
      ws.isAlive = false;
      console.log("wss send error: " + e.message);
      return;
    }
    user = { ...user, last_feed };
    user = await pg.updateRecord<Dbt.User>("users", user);
    cache.setUser(user);
  }

  //console.log("attaching handlers");
  ws.on('message', async message => {
    //console.log(message);
    let req = JSON.parse(message);
    if (req.ping) {
      ws.send('{"pong": true}');
      return;
    }
    let token = req.jwt;
    let userJwt = jwt.verifyJwt(token);
    let user: Dbt.User = cache.users.get(userJwt.id);
    if (!user) throw new Error("Invalid user id");
    ws.userName = user.userName;

    let profile_pic = user.profile_pic
    let now = new Date();
    let last_feed = req.last_feed ? new Date(req.last_feed) : user.last_feed;
    let feed = await pg.updateUserFeed(user.userId, last_feed);
    let allTags = cache.allTags();
    let result: Rpc.InitializeResponse = { ok: true, redirectUrl: '', profile_pic, feed, allTags, last_feed: now.toISOString() };

    let msg: SrvrMsg.MessageItem = { type: "Init", message: result };
    sendMessages(user.userId, [msg], now)

    let sub: cache.Subscription;
    sub = {
      filter: u => true,
      send: async (updts, now) => {
        try {
          let messages: SrvrMsg.MessageItem[] = [];
          let filtrd = updts.filter(u => (u.table === "tags") || (u.record.userId && u.record.userId === user.userId))
          for (const updt of filtrd) {
            let msg: SrvrMsg.MessageItem;
            switch (updt.table) {
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
                let message = updt.remove ? { link, linkDepth: 0, viewCount: 0, promotionsCount: 0, deliveriesCount: 0 } : await pg.getUserLinkItem(link.linkId);
                msg = { type: "Link", message };
                break;
              }
            }
            if (msg) {
              if (updt.remove) msg.remove = true;
              messages.push(msg);
            }
          };

          let feeds = await pg.liveUserFeed(user.userId, updts)
          feeds.forEach(message => messages.push({ type: "Feed", message }));
          if (messages.length > 0) sendMessages(user.userId, messages, now)
        }
        catch (e) {
          console.log("Error handling subscription updates: " + e.message);
        }
      }
    };
    cache.subscribe(sub);
    _socketSubs.push({ ws, sub });
  });
}

