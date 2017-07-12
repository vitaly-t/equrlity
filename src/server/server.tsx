import * as dotenv from 'dotenv-safe';
let env = dotenv.config();
console.log("dotenv loaded");

// internal node
import * as fs from "fs"
import * as path from "path"
import { Url, parse } from 'url';

// node_modules
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server'
import axios from 'axios';
import * as Koa from "koa";
import * as Router from 'koa-joi-router';
import * as send from 'koa-send';
import * as cors from 'kcors';
import * as koaBody from 'koa-body';
import * as range from 'koa-range';
import { createReadStream } from 'streamifier';
import websockify from './koa-ws';

// lib
import * as OxiDate from '../lib/oxidate';
import * as uuid from '../lib/uuid.js';
import { promisify } from '../lib/promisify';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes'
import * as Rpc from '../lib/rpc';
import { ContentView } from '../lib/contentView';
import { LinkLandingPage, HomePage, ContentLandingPage, UserLandingPage } from '../lib/landingPages';
import { validateContentSignature } from '../lib/Crypto';
import * as SrvrMsg from '../lib/serverMessages';

//gen
import * as OxiGen from '../gen/oxigen';

// local
import * as jwt from './jwt';
import { serve } from './koa-static';
//import * as favicon from 'koa-favicon';
import clientIP from './clientIP.js';
import * as pg from './pgsql';
import * as cache from './cache';

const jwt_secret = process.env.JWT_PSEUDOQURL_KEY;
const jwtOptions = { secret: jwt_secret, ignoreExpiration: true, key: 'userId' };

pg.init();

function getUser(id: Dbt.userId): Dbt.User {
  return cache.users.get(id);
}

function readFileAsync(src: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    fs.readFile(src, { 'encoding': 'utf8' }, function (err, data) {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function isValidClient(ctx: Koa.Context) {
  return ctx['userId'] && !ctx['invalidClientMsg'];
}

function htmlPage(body) {
  // <link rel="shortcut icon" href="/favicon.ico" />

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="google-site-verification" content="mJoHqP8RhSQWE6NhUmdXDjo8oWgUC6nrBELkQS8bEZU" />
  <link href="/node_modules/@blueprintjs/core/dist/blueprint.css" rel="stylesheet" />
  <link href="/node_modules/react-select/dist/react-select.css" rel="stylesheet" />
  <link href="/node_modules/react-simple-flex-grid/lib/main.css" rel="stylesheet" />
</head>
<body>
  ${body}
</body>
</html>
`;
}

function mediaPage(cont: Dbt.Content): string {
  return linkMediaPage(cont, '');
}

function linkMediaPage(cont: Dbt.Content, linkId: Dbt.linkId): string {
  //if (cont.contentType === 'post') return postPage(cont);
  let mime_type = cont.contentType + "/" + cont.mime_ext;

  //<link rel="shortcut icon" href="/favicon.ico" />

  let body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="/node_modules/@blueprintjs/core/dist/blueprint.css" rel="stylesheet" />
  <link href="/node_modules/react-select/dist/react-select.css" rel="stylesheet" />
  <link href="/node_modules/react-simple-flex-grid/lib/main.css" rel="stylesheet" />
  <link href="/node_modules/video.js/dist/video-js.css" rel="stylesheet" />
</head>
<body>
  <script type="text/javascript" src="/dist/media_bndl.js"></script>
  <div id="app" data-link-id="${linkId}" data-content-id="${cont.contentId}" data-mime-type="${mime_type}"></div>
</body>
</html>  
`;
  return body;
}

const app = websockify(new Koa());
//const app = new Koa();
app.keys = ['pseudoqurl'];  //@@GS what does this do again?

//const publicRouter = new Router();
const publicRouter = Router();

//app.use(session(app));
//app.use(passport.initialize());
//app.use(passport.session());
//app.use(flash());

//app.use(bodyParser());

/*
app.use(async (ctx, next) => {
  console.log(ctx.path);
  await next();
});
*/

app.use(koaBody({ formidable: { uploadDir: __dirname } }));

app.use(
  cors({
    origin: "*",
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
    allowHeaders: ["X-Requested-With", "Content-Type", "Authorization", "x-psq-client-version"],
    exposeHeaders: ["x-psq-token", "x-psq-moniker", "x-psq-email", "x-psq-credits", "x-psq-groups"],
  }) as Koa.Middleware
);

app.use(range);
app.use(serve("node_modules", "./node_modules"));
app.use(serve("dist", "./dist"));
//app.use(favicon(__dirname + '/assets/favicon.ico'));
//

app.use(async (ctx, next) => {
  let client_ver = ctx.headers['x-psq-client-version'];
  let msg;
  if (!client_ver) msg = 'Invalid Client - missing header';
  else {
    let [client, version] = client_ver.split("-");
    if (client !== 'capuchin') msg = 'Unknown Client';
    else {
      if (version !== Utils.capuchinVersion()) {
        msg = `Client (${version}) is behind server (${Utils.capuchinVersion()})  and requires upgrade`;
      }
    }
  }
  if (msg) {
    ctx['invalidClientMsg'] = msg
    //console.log("Invalid Client : " + msg);
  }
  try {
    await next();
  }
  catch (e) {
    console.log("Error: " + e.message);
    throw (e);
  }
});

app.use(jwt.jwt(jwtOptions));

/*
publicRouter.get('/download/pseudoqurl.crx', async function (ctx, next) {
  ctx.headers['Content-Type'] = "application/x-chrome-extension";
  await send(ctx, './assets/pseudoqurl.crx');
});
*/

publicRouter.get('/download/pseudoqurl.zip', async function (ctx, next) {
  await send(ctx, './assets/pseudoqurl-plugin.zip');
});

publicRouter.get('/download/pseudoqurl.tar.gz', async function (ctx, next) {
  await send(ctx, './assets/pseudoqurl-plugin.tar.gz');
});

publicRouter.get('/link/:id', async (ctx, next) => {
  let linkId: Dbt.linkId = ctx.params.id;
  let link = cache.links.get(linkId);
  if (!link) ctx.throw(404);
  let userName = cache.users.get(link.userId).userName;
  let cont = cache.contents.get(link.contentId);
  if (!cont) ctx.throw(500);
  let isClient = isValidClient(ctx);
  let ip = clientIP(ctx);
  let viewerId = isClient ? ctx['userId'].id : null;
  if (isClient || link.isPublic) {
    if (cont.contentType === 'bookmark') {
      if (isClient && !link.isPublic) await pg.payForView(viewerId, linkId, 0)
      ctx.status = 303;
      ctx.redirect(cont.url);
      return;
    }
    pg.registerContentView(viewerId, cont.contentId, ip, linkId);
    ctx.body = await linkMediaPage(cont, linkId);
    return;
  }
  pg.registerInvitation(ip, linkId);
  let url = link.isPublic && cont.contentType === 'bookmark' ? cont.url : null;
  let view = <LinkLandingPage url={url} userName={userName} />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let body = htmlPage(ins);
  ctx.body = body;

});

publicRouter.get('/stream/content/:id', async (ctx, next) => {
  let contentId = ctx.params.id;
  let cont = cache.contents.get(contentId);
  if (!cont || !cont.db_hash) ctx.throw(404);
  if (!isValidClient(ctx) && !cont.isPublic) ctx.throw(403);
  let viewerId = cont.isPublic ? null : ctx['userId'].id;
  let lob = await pg.retrieveBlobContent(contentId);
  let strm = createReadStream(lob);
  ctx.body = strm;
});

publicRouter.get('/stream/link/:id', async (ctx, next) => {
  let linkId = ctx.params.id;
  let link = cache.links.get(linkId);
  if (!link) ctx.throw(404);
  if (!isValidClient(ctx) && !link.isPublic) ctx.throw(403);
  let contentId = link.contentId;
  let cont = cache.contents.get(contentId);
  if (!cont || !cont.db_hash) ctx.throw(404);
  let viewerId = link.isPublic ? null : ctx['userId'].id;
  let lob = await pg.retrieveBlobContent(contentId);
  let strm = createReadStream(lob);
  ctx.body = strm;
});

publicRouter.get('/blob/content/peaks/:id', async (ctx, next) => {
  let contentId = ctx.params.id;
  let cont = cache.contents.get(contentId);
  if (!cont || !cont.db_hash) ctx.throw(404);
  let lob = await pg.getAudioPeaks(cont.db_hash);
  let json = JSON.parse(lob);
  ctx.body = json;
});

publicRouter.get('/blob/link/peaks/:id', async (ctx, next) => {
  let linkId = ctx.params.id;
  let link = cache.links.get(linkId);
  if (!link) ctx.throw(404);
  let contentId = link.contentId;
  let cont = cache.contents.get(contentId);
  if (!cont || !cont.db_hash) ctx.throw(404);
  let lob = await pg.getAudioPeaks(cont.db_hash);
  let json = JSON.parse(lob);
  ctx.body = json;
});

publicRouter.get('/blob/content/:id', async (ctx, next) => {
  let contentId = ctx.params.id;
  let cont = cache.contents.get(contentId);
  if (!cont || !cont.db_hash) ctx.throw(404);
  if (!isValidClient(ctx) && !cont.isPublic) ctx.throw(403);
  let lob = await pg.retrieveBlobContent(contentId);
  ctx.body = lob;
});

publicRouter.get('/blob/link/:id', async (ctx, next) => {
  let linkId = ctx.params.id;
  let link = cache.links.get(linkId);
  if (!link) ctx.throw(404);
  if (!isValidClient(ctx) && !link.isPublic) ctx.throw(403);
  let contentId = link.contentId;
  let cont = cache.contents.get(contentId);
  if (!cont || !cont.db_hash) ctx.throw(404);
  let lob = await pg.retrieveBlobContent(contentId);
  ctx.body = lob;
});

publicRouter.get('/load/content/:id', async (ctx, next) => {
  let contentId = ctx.params.id;
  let content = cache.contents.get(contentId);
  if (!content) {
    ctx.status = 404;
    ctx.body = { id: -1, error: { message: "Invalid content" } };
  }
  if (!isValidClient(ctx) && !content.isPublic) {
    ctx.status = 403;
    ctx.body = { id: -1, error: { message: "Unauthorized access" } };
  }
  let owner = cache.users.get(content.userId).userName;
  let a = await pg.getCommentsForContent(contentId)
  let comments: Rpc.CommentItem[] = a.map(c => {
    let userName = cache.users.get(c.userId).userName;
    return { ...c, userName }
  })

  let peaks = false;
  if (content.contentType === 'audio' && await pg.getAudioPeaks(content.db_hash)) peaks = true;

  let result: Rpc.LoadContentResponse = { content, owner, comments, paymentSchedule: [], streamNumber: 0, peaks, linkDepth: 0 }
  ctx.body = { result };
});

publicRouter.get('/load/link/:id', async (ctx, next) => {
  let linkId = ctx.params.id;
  let link = cache.links.get(linkId);
  if (!link) {
    ctx.status = 404;
    ctx.body = { id: -1, error: { message: "Invalid link" } };
  }
  if (!isValidClient(ctx) && !link.isPublic) {
    ctx.status = 403;
    ctx.body = { id: -1, error: { message: "Unauthorized access" } };
  }
  let contentId = link.contentId;
  let content = cache.contents.get(contentId);
  if (!content) {
    ctx.status = 404;
    ctx.body = { id: -1, error: { message: "Invalid content" } };
  }
  let owner = cache.users.get(content.userId).userName;
  let a = await pg.getCommentsForContent(contentId)
  let comments: Rpc.CommentItem[] = a.map(c => {
    let userName = cache.users.get(c.userId).userName;
    return { ...c, userName }
  })
  let streamNumber = 0;
  let { paymentSchedule } = link
  let viewerId = link.isPublic ? null : ctx['userId'].id;
  if (viewerId) streamNumber = await pg.getNextStreamNumber(viewerId, linkId);

  let peaks = false;
  if (content.contentType === 'audio' && await pg.getAudioPeaks(content.db_hash)) peaks = true;
  let linkDepth = cache.getChainFromLinkId(linkId).length - 1;
  let result: Rpc.LoadContentResponse = { content, owner, comments, paymentSchedule, streamNumber, peaks, linkDepth }
  ctx.body = { result };
});

publicRouter.get('/content/:id', async (ctx, next) => {
  let contentId = ctx.params.id;
  let cont = cache.contents.get(contentId);
  if (!cont) ctx.throw(404);
  if (!isValidClient(ctx) && !cont.isPublic) {
    let userName = cache.users.get(cont.userId).userName;
    let view = <ContentLandingPage userName={userName} />;
    let ins = ReactDOMServer.renderToStaticMarkup(view);
    let body = htmlPage(ins);
    ctx.body = body;
  }
  else ctx.body = await mediaPage(cont);
});

publicRouter.get('/user/:id/img', async (ctx, next) => {
  let userName = ctx.params.id;
  let user = cache.getUserByName(userName);
  if (!user) ctx.throw(404);
  if (!user.profile_pic) ctx.body = "No image provided";
  else {
    let img = await pg.retrieveBlob(user.profile_pic);
    ctx.body = img;
  }
});

publicRouter.get('/user/:id', async (ctx, next) => {
  let userName = ctx.params.id;
  let user = cache.getUserByName(userName);
  if (!user) ctx.throw(404);
  /*
  if (user.home_page) {
    ctx.status = 303;
    ctx.redirect(user.home_page);
    return;
  }
  */
  let isClient = isValidClient(ctx);
  let email = isClient ? ctx['userId'].email : '';
  let view = <UserLandingPage user={user} email={email} isClient={isClient} />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let body = htmlPage(ins);
  ctx.body = body;
});


// need to serve this route before static files are enabled??
publicRouter.get('/', async (ctx, next) => {
  let view = <HomePage />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let body = htmlPage(ins);
  ctx.body = body;

});

publicRouter.post('/auth', async (ctx, next) => {
  let userInfo = ctx.request.body.userInfo;
  let publicKey = ctx.request.body.publicKey;
  let authValue = ctx.headers.authorization;
  let token;
  try {
    token = authValue.split(" ")[1];
  } catch (e) {
    token = "";
  }
  if (Utils.isProduction() && (!userInfo || !publicKey || !authValue || !token)) {
    ctx.status = 400;
    return;
  }

  //console.log("We got such auth data: ");
  //console.log("Key: " + JSON.stringify(publicKey));
  //console.log("User: " + JSON.stringify(userInfo));
  //console.log("Token: " + token);

  let authId = userInfo.id;
  let email = userInfo.email;
  if (Utils.isProduction()) {
    let authRsp = await axios.create({ responseType: "json" }).get(Utils.chromeAuthUrl + token);
    if (authRsp.status !== 200 || authRsp.data.user_id !== authId) {
      ctx.throw(401, "Authentication failed!");
      return;
    }
  }
  let user = await pg.getUserByAuthId(authId, "chrome");
  if (!user) {
    user = await pg.createUser(email);
    await pg.createAuth(authId, user.userId, "chrome");
  }
  let id = user.userId;
  token = jwt.sign({ id, publicKey, email }, jwt_secret);
  ctx.body = { jwt: token };
}
);

app.use(publicRouter.middleware());

//  From here on, it's for known client(s) only

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: { message: 'Unhandled error on Server : ' + err.message } };
  }
});

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

app.ws.use(async function (ctx, next) {
  let ws = ctx.websocket;
  ws.on('message', (message) => {
    console.log(message);
    let msg = JSON.parse(message);
    let token = msg.jwt;
    let opts = jwtOptions;
    let userId = jwt.verify(token, opts.secret, opts);
    let user: Dbt.User = getUser(userId.id);
    if (!user) throw new Error("Invalid user id");
    let sub: cache.Subscription;
    sub = {
      filter: u => u.record.userId && u.record.userId === user.userId,
      send: async updts => {
        let msgs: SrvrMsg.Message[] = [];
        updts.forEach(updt => {
          let msg: SrvrMsg.Message;
          switch (updt.table) {
            case "contents": {
              msg = { type: "Content", message: updt.record };
              break;
            }
            case "links": {
              msg = { type: "Link", message: updt.record };
              break;
            }
          }
          if (msg) {
            if (updt.remove) msg.remove = true;
            msgs.push(msg);
          }
        });
        let feeds = await pg.liveUserFeed(user.userId, updts)
        feeds.forEach(message => msgs.push({ type: "Feed", message }));
        if (msgs.length > 0) {
          try {
            ws.send(JSON.stringify(msgs));
          }
          catch (e) {
            ws.isAlive = false;
            throw (e);
          }
        }
      }
    };
    cache.subscribe(sub);
    _socketSubs.push({ ws, sub });
  });
  await next();
});

app.use(async function (ctx, next) {
  if (ctx['invalidClientMsg']) {
    ctx.status = 400;
    ctx.body = { error: { message: ctx['invalidClientMsg'] } };
    return;
  }
  let _userId: any;
  if (!ctx['userId']) {
    if (Utils.isProduction()) {
      ctx.status = 400;
      ctx.body = { error: { message: 'Unauthorized access' } };
      return;
    }
  }
  else _userId = { ...ctx['userId'] };
  await next();

  let userId = ctx['userId'];
  let user: Dbt.User = getUser(userId.id);
  if (!user) throw new Error("system corruption detected");
  let { publicKey, email, id } = userId;
  if (!_userId || _userId.publicKey !== publicKey || _userId.email !== email || _userId.id !== id) {
    let token = jwt.sign(userId, jwt_secret); //{expiresInMinutes: 60*24*14});
    console.log("sending token");
    ctx.set('x-psq-token', token);
  }
  ctx.set('x-psq-credits', user.credits.toString());
  ctx.set('x-psq-moniker', user.userName);
  ctx.set('x-psq-email', email);
  ctx.set('x-psq-homepage', user.home_page);

  await pg.touchUser(user.userId);
});

app.use(async function (ctx, next) {
  let userId = ctx['userId'];
  if (!userId) {
    console.log("jwt returned no key");
    let ipAddress = clientIP(ctx);
    let user = await pg.createUser();
    ctx['userId'] = { id: user.userId };
    ctx['user'] = user;
    let inv = await pg.retrieveRecord<Dbt.Invitation>("invitations", { ipAddress });
    if (inv) {
      await pg.deleteRecord("invitations", inv);
      if (cache.links.has(inv.linkId)) {
        let link = cache.links.get(inv.linkId);
        cache.connectUsers(user.userId, link.userId);
        ctx['redirectUrl'] = cache.linkToUrl(inv.linkId);
      }
    }
  }
  else {
    let user = getUser(userId.id);
    if (!user) {
      ctx.status = 400;
      ctx.body = { error: { message: 'Invalid token supplied (out of date?)' } };
      return;
    }
    ctx['user'] = user;
  }
  ctx['token'] = jwt.sign(ctx['userId'], jwt_secret); //{expiresInMinutes: 60*24*14});
  await next();
});

async function handleRequest<I, O>(method: Rpc.Handler<I, O>, req: I): Promise<O> {
  return method(req);
}

function checkPK(ctx: any, publicKey: JsonWebKey) {
  let pk = ctx.userId.publicKey;
  if (!pk) throw new Error("missing public key from token");
  if (JSON.stringify(publicKey) !== JSON.stringify(pk)) throw new Error("Invalid publicKey submitted");
}

const router = Router();

router.route({
  method: 'post',
  path: '/upload/media',
  validate: { type: 'multipart' },
  handler: async (ctx) => {
    const parts = ctx.request.parts;
    const userId = ctx.userId.id;

    let part;
    let cont: Dbt.Content;
    let pk = ctx.userId.publicKey;

    try {
      while (part = await parts) {
        let pth = path.parse(part.filename);
        let mime_ext = pth.ext.replace(".", "");
        let contentType: Dbt.contentType = part.mime.substring(0, part.mime.indexOf("/"));
        let peaks;
        if (contentType === 'audio') peaks = parts.field.peaks;
        cont = await pg.insertBlobContent(part, '', mime_ext, contentType, part.filename, peaks, userId);
      }
      let hash = parts.field.hash;
      if (hash !== cont.db_hash || !validateContentSignature(pk, hash, parts.field.sig)) {
        await pg.deleteContent(cont);
        throw new Error("Invalid hash for: " + part.filename);
      }
    } catch (err) {
      console.log(err);
      ctx.throw(err);
    }
    cache.setContent(cont);
    ctx.body = JSON.stringify(cont);
  }
});

router.post('/rpc', async function (ctx: any) {
  let { jsonrpc, method, params, id } = ctx.request.body;  // from bodyparser 

  if (jsonrpc != "2.0") {
    let error: Rpc.Error = { id, error: { code: -32600, message: "Invalid version" } };
    if (id) ctx.body = error;
    return;
  }

  let userId = ctx.userId.id;
  try {
    switch (method as Rpc.Method) {
      case "initialize": {
        let req: Rpc.InitializeRequest = params;
        checkPK(ctx, req.publicKey)
        let usr = getUser(userId);
        if (!usr) throw new Error("Internal error getting user details");
        let redirectUrl = ctx['redirectUrl'];
        let allTags = await pg.loadTags();
        let profile_pic = usr.profile_pic
        let feed = await pg.updateUserFeed(userId);
        let result: Rpc.InitializeResponse = { ok: true, allTags, redirectUrl, profile_pic, feed };
        ctx.body = { id, result };
        break;
      }
      case "updateFeed": {
        //let req: Rpc.UpdateFeedRequest = params;
        let feed = await pg.updateUserFeed(userId);
        let result: Rpc.UpdateFeedResponse = { feed };
        ctx.body = { id, result };
        break;
      }
      case "promoteContent": {
        let req: Rpc.PromoteContentRequest = params;
        let { contentId, signature } = req;
        if (!validateContentSignature(ctx.userId.publicKey, contentId.toString(), signature)) throw new Error("request failed verification");
        let usr = getUser(userId);
        let result: Rpc.PromoteContentResponse = await pg.handlePromoteContent(userId, req)
        ctx.body = { id, result };
        break;
      }
      case "bookmarkLink": {
        let req: Rpc.BookmarkLinkRequest = params;
        let { url, signature } = req;
        let ourl = parse(url);
        if (!validateContentSignature(ctx.userId.publicKey, url, signature)) throw new Error("request failed verification");
        let usr = getUser(userId);
        await pg.saveTags(req.tags)
        let result: Rpc.BookmarkLinkResponse = await pg.handleBookmarkLink(userId, req)
        ctx.body = { id, result };
        break;
      }
      case "loadLink": {
        let req: Rpc.LoadLinkRequest = params;
        let content = await pg.retrieveBookmark(req.url, userId);
        let result: Rpc.LoadLinkResponse = { content };
        ctx.body = { id, result };
        break;
      }
      case "changeSettings": {
        let req: Rpc.ChangeSettingsRequest = params;
        let { userName, homePage, info, profile_pic, subscriptions, blacklist } = req;
        let usr = getUser(userId);
        if (!usr) throw new Error("Internal error getting user details");
        if (userName && userName !== usr.userName) {
          if (await pg.checkMonikerUsed(userName)) {
            ctx.body = { id, error: { message: "Nickname not available" } };
            return;
          }
        }
        if (profile_pic && profile_pic !== usr.profile_pic) {
          if (!await pg.checkProfilePic(profile_pic, userId)) {
            ctx.body = { id, error: { message: "Invalid Profile Pic provided" } };
            return;
          }
        } else profile_pic = '';
        let following = req.following.map(nm => cache.getUserByName(nm).userId);
        let i = following.indexOf(userId);
        if (i >= 0) following.splice(i, 1);
        usr = { ...usr, userName, home_page: homePage, info, profile_pic, subscriptions, blacklist, following };
        let updts = await pg.upsertUser(usr);
        cache.update(updts);
        let result: Rpc.ChangeSettingsResponse = { ok: true };
        ctx.body = { id, result };
        break;
      }
      case "getUserContents": {
        //let req: Rpc.GetUserContentsRequest = params;
        let contents = await pg.getUserContents(userId);
        let result: Rpc.GetUserContentsResponse = { contents };
        ctx.body = { id, result };
        break;
      }
      case "getUserLinks": {
        //let req: Rpc.GetUserLinksRequest = params;
        let links = await pg.getUserLinks(userId);
        let promotions = await pg.deliverNewPromotions(userId);
        let connectedUsers = cache.getConnectedUserNames(userId);
        let reachableUserCount = cache.getReachableUserIds(userId).length;
        let allTags = await pg.loadTags();
        let result: Rpc.GetUserLinksResponse = { links, promotions, connectedUsers, reachableUserCount, allTags };
        ctx.body = { id, result };
        break;
      }
      case "getUserSettings": {
        //let req: Rpc.GetUserSettingsRequest = params;
        let user = cache.users.get(userId);
        let email = ctx['userId'].email;
        let homePage = user.home_page;
        let { info, userName, profile_pic, subscriptions, blacklist } = user;
        let following = cache.getUserFollowings(userId);
        let allUsers = cache.allUserNames(userId);
        let result: Rpc.GetUserSettingsResponse = { userName, email, homePage, info, profile_pic, subscriptions, blacklist, following, allUsers };
        ctx.body = { id, result };
        break;
      }
      case "redeemLink": {
        let req: Rpc.RedeemLinkRequest = params;
        let link = cache.links.get(req.linkId);
        if (link.amount === 0) await pg.removeLink(link);
        else await pg.redeemLink(link);
        let links = await pg.getUserLinks(userId);
        let result: Rpc.RedeemLinkResponse = { links };
        ctx.body = { id, result };
        break;
      }
      case "saveContent": {
        let req: Rpc.SaveContentRequest = params;
        let content = req.content;
        if (content.userId !== userId) {
          if (content.userId) throw new Error("incorrect user for content");
          content = { ...content, userId };
        }
        let title = content.title.replace(/_/g, " ");
        content = { ...content, title };
        if (content.contentId) content = await pg.updateRecord<Dbt.Content>("contents", content);
        else content = await pg.insertContent(content);
        cache.setContent(content);
        await pg.saveTags(req.content.tags)
        let result: Rpc.SaveContentResponse = { content };
        ctx.body = { id, result };
        break;
      }
      case "removeContent": {
        let req: Rpc.RemoveContentRequest = params;
        let content = cache.contents.get(req.contentId);
        if (content.userId !== userId) {
          if (content.userId) throw new Error("incorrect user for content");
        }
        await pg.deleteContent(content);
        let result: Rpc.RemoveContentResponse = { ok: true };
        ctx.body = { id, result };
        break;
      }
      case "saveLink": {
        let req: Rpc.SaveLinkRequest = params;
        if (req.link.userId !== userId) throw new Error("incorrect user for content");
        let link = await pg.updateRecord<Dbt.Link>("links", req.link);
        let result: Rpc.SaveLinkResponse = { link };
        ctx.body = { id, result };
        break;
      }
      case "aditComment": {
        let req: Rpc.AditCommentRequest = params;
        let { parent, comment, contentId, commentId } = req;
        parent = parent || null;
        let cmt: Dbt.Comment;
        if (commentId) {
          let rec = await pg.retrieveRecord<Dbt.Comment>("comments", { commentId });
          rec = { ...rec, comment }
          cmt = await pg.updateRecord<Dbt.Comment>("comments", rec);
        }
        else {
          let rec = OxiGen.emptyRec<Dbt.Comment>("comments");
          rec = { ...rec, parent, comment, contentId, userId }
          cmt = await pg.insertRecord<Dbt.Comment>("comments", rec);
        }
        let userName = cache.users.get(cmt.userId).userName;
        let itm: Rpc.CommentItem = { ...cmt, userName }
        let result: Rpc.AditCommentResponse = { comment: itm };
        ctx.body = { id, result };
        break;
      }
      case "dismissSquawks": {
        let req: Rpc.DismissSquawksRequest = params;
        await pg.dismissSquawks(userId, req.urls, req.save);
        let result: Rpc.DismissSquawksResponse = { ok: true };
        ctx.body = { id, result };
        break;
      }
      case "cachePeaks": {
        let req: Rpc.CachePeaksRequest = params;
        let cont = cache.contents.get(req.contentId);
        await pg.updateAudioPeaks(cont.db_hash, req.peaks, userId);
        let result: Rpc.CachePeaksResponse = { ok: true };
        ctx.body = { id, result };
        break;
      }
      case "payForView": {
        let req: Rpc.PayForViewRequest = params;
        let { linkId, purchase, amount } = req;
        let content: Dbt.Content | null = null;
        if (purchase) content = await pg.purchaseContent(userId, linkId, amount);
        else await pg.payForView(userId, linkId, amount);
        let result: Rpc.PayForViewResponse = { ok: true, content };
        ctx.body = { id, result };
        break;
      }
      default:
        let error: Rpc.Error = { id, error: { code: -32601, message: "Invalid method: " + method } };
        ctx.body = error;
    }
  }
  catch (e) {
    console.log("returning rpc error: " + e.message);
    ctx.body = { id, error: { message: e.message } };
  }

});

/*
router.get('/auth/facebook', function (ctx, next) {
  passport.authenticate('facebook')
});
 
router.get('/auth/facebook/callback', async function (ctx, next) {
  return passport.authenticate('facebook', async function (err, authId, info, status) {
    await authent(ctx, 'facebook', authId);
    ctx.body = { ok: true };
  })(ctx, next);
});
 
app.use(router.get('/auth/google', function *() {
    var ctx = this
    yield passport.authenticate('google', function *(err, authId, info) {
        console.log("google called back");
        if (err) throw err
        if (info) console.log("info : "+info);
        yield authent(ctx, 'google', authId);
        ctx.redirect('/#/refresh');
    }).call(this);
}));
 
app.use(router.get('/auth/github', function *() {
    var ctx = this
    yield passport.authenticate('github', function*(err, authId, info) {
        if (err) throw err
        if (info) console.log("info : "+info);
        yield authent(ctx, 'github', authId);
        ctx.redirect('/#/refresh');
    }).call(this);
}));
 
app.use(router.get('/auth/twitter', function *() {
    var ctx = this
    yield passport.authenticate('twitter', function*(err, authId, info) {
        if (err) throw err
        if (info) console.log("info : "+info);
        yield authent(ctx, 'twitter', authId);
        ctx.redirect('/#/refresh');
    }).call(this);
}));
 
*/



//app.use(router.routes())
//app.use(router.allowedMethods());
app.use(router.middleware())

if (Utils.isStaging()) console.log("Using staging mode");

//pg.buildMissingWaveforms();

const port = parseInt(process.env.PORT, 10) || 8080;

console.log("Listening at " + Utils.serverUrl);
app.listen(port);





