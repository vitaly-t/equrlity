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
//import * as bodyParser from 'koa-bodyparser';
//import * as Router from 'koa-router';
import * as Router from 'koa-joi-router';
import * as send from 'koa-send';
import * as cors from 'kcors';
import * as koaBody from 'koa-body';
import * as range from 'koa-range';
import { createReadStream } from 'streamifier';

// lib
import * as OxiDate from '../lib/oxidate';
import * as uuid from '../lib/uuid.js';
import { promisify } from '../lib/promisify';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes'
import * as Rpc from '../lib/rpc';
import { ContentView } from '../lib/contentView';
import { LinkLandingPage, HomePage, ContentLandingPage } from '../lib/landingPages';
import { validateContentSignature } from '../lib/Crypto';


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
</head>
<body>
  ${body}
</body>
</html>
`;
}

function postPage(cont: Dbt.Content): string {
  let creator = cache.users.get(cont.userId).userName;
  let view = <ContentView info={cont} creator={creator} />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let body = htmlPage(ins);
  return body;
}

function mediaPage(cont: Dbt.Content): string {
  if (cont.contentType === 'post') return postPage(cont);
  let mime_type = cont.contentType + "/" + cont.mime_ext;

  //<link rel="shortcut icon" href="/favicon.ico" />

  let body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="/node_modules/@blueprintjs/core/dist/blueprint.css" rel="stylesheet" />
  <link href="/node_modules/video.js/dist/video-js.css" rel="stylesheet" />
</head>
<body>
  <script type="text/javascript" src="/dist/media_bndl.js"></script>
  <div id="app" data-content-id="${cont.contentId}" data-mime-type="${mime_type}"></div>
</body>
</html>  
`;
  return body;
}

const app = new Koa();
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
    else if (version !== Utils.capuchinVersion()) msg = 'Client is out-of-date and requires upgrade';
  }
  if (msg) {
    ctx['invalidClientMsg'] = msg
    console.log("Invalid Client : " + msg);
  }
  await next();
});

app.use(jwt.jwt(jwtOptions));

publicRouter.get('/download/pseudoqurl.crx', async function (ctx, next) {
  ctx.headers['Content-Type'] = "application/x-chrome-extension";
  await send(ctx, './assets/pseudoqurl.crx');
});

publicRouter.get('/download/pseudoqurl.zip', async function (ctx, next) {
  await send(ctx, './assets/pseudoqurl-plugin.zip');
});

publicRouter.get('/download/pseudoqurl.tar.gz', async function (ctx, next) {
  await send(ctx, './assets/pseudoqurl-plugin.tar.gz');
});

publicRouter.get('/link/:id', async (ctx, next) => {
  let linkId: Dbt.linkId = parseInt(ctx.params.id);
  let link = cache.links.get(linkId);
  let cont = cache.contents.get(link.contentId);
  let isClient = isValidClient(ctx);
  if (isClient && cont.contentType === 'link') {
    // tab should be redirected by client
    ctx.body = "tab should redirect";
    return;
  }
  if (cont.isPublic || isClient) {
    let ipAddress = clientIP(ctx);
    pg.registerContentView(ctx['userId'].id, cont.contentId, ipAddress, linkId);
    ctx.body = await mediaPage(cont);
    return;
  }
  let url = cache.getContentFromLinkId(linkId);
  let ip = clientIP(ctx);
  pg.registerInvitation(ip, linkId);
  let view = <LinkLandingPage url={url} />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let body = htmlPage(ins);
  ctx.body = body;

});

publicRouter.get('/content/*', async (ctx, next) => {
  if (isValidClient(ctx)) await next();
  else {
    let view = <ContentLandingPage />;
    let ins = ReactDOMServer.renderToStaticMarkup(view);
    let body = htmlPage(ins);
    ctx.body = body;
  }
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
  if (!userInfo || !publicKey || !authValue || !token) {
    ctx.status = 400;
    return;
  }

  //console.log("We got such auth data: ");
  //console.log("Key: " + JSON.stringify(publicKey));
  //console.log("User: " + JSON.stringify(userInfo));
  //console.log("Token: " + token);

  let authId = userInfo.id;
  let email = userInfo.email;
  let authRsp = await axios.create({ responseType: "json" }).get(Utils.chromeAuthUrl + token);
  if (authRsp.status === 200 && authRsp.data.user_id === authId) {
    let user = await pg.getUserByAuthId(authId, "chrome");
    if (!user) {
      user = await pg.createUser(email);
      await pg.createAuth(authId, user.userId, "chrome");
    }
    let id = user.userId;
    token = jwt.sign({ id, publicKey, email }, jwt_secret);
    ctx.body = { jwt: token };
  }
  else ctx.throw(401, "Authentication failed!");
});

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

app.use(async function (ctx, next) {
  if (ctx['invalidClientMsg']) {
    ctx.status = 400;
    ctx.body = { error: { message: ctx['invalidClientMsg'] } };
    return;
  }
  if (!ctx['userId']) {
    ctx.status = 400;
    ctx.body = { error: { message: 'Unauthorized access' } };
    return;
  }
  let _userId = { ...ctx['userId'] };
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


//const router = new Router();
const router = Router();

router.get('/content/:contentType/:title', async (ctx, next) => {
  let title = decodeURIComponent(ctx.params.title);
  let contentType = decodeURIComponent(ctx.params.contentType) as Dbt.contentType;
  let path = "/" + contentType + "/" + title;
  let cont = await pg.retrieveContentByTitle(title, contentType);
  if (!cont) ctx.throw(404);
  ctx.body = await mediaPage(cont);
});

router.get('/stream/content/:id', async (ctx, next) => {
  let contentId = parseInt(ctx.params.id);
  let lob = await pg.retrieveBlobContent(contentId);
  let strm = createReadStream(lob);
  /*
    async function gotFile(blob: Buffer) {
      console.log("file: " + part.filename);
      let pth = path.parse(part.filename);
      let mime_ext = pth.ext.replace(".", "");
      let contentType: Dbt.contentType = part.mime.substring(0, part.mime.indexOf("/"));
      await pg.insertBlobContent(blob, '', mime_ext, contentType, part.filename, userId);
    }
    //let blob = await pg.retrieveRecord<Dbt.Blob>("blobs", { blobId: cont.blobId })
    //let strm = createReadStream(blob.blobContent);
    var concatStream = concat(gotFile)
  */

  ctx.body = strm;
  //ctx.body = blob.blobContent;
});


router.get('/content/:id', async (ctx, next) => {
  let contentId = parseInt(ctx.params.id);
  let cont = cache.contents.get(contentId);
  if (!cont) ctx.throw(404);
  ctx.body = await mediaPage(cont);
});

router.route({
  method: 'post',
  path: '/upload/media',
  validate: { type: 'multipart' },
  handler: async (ctx) => {
    const parts = ctx.request.parts;
    const userId = ctx.userId.id;

    let part;
    let rslt = []

    try {
      while (part = await parts) {
        let pth = path.parse(part.filename);
        let mime_ext = pth.ext.replace(".", "");
        let contentType: Dbt.contentType = part.mime.substring(0, part.mime.indexOf("/"));
        let cont = await pg.insertBlobContent(part, '', mime_ext, contentType, part.filename, userId);
        rslt.push(cont);
      }
    } catch (err) {
      console.log(err);
      ctx.throw(err);
    }
    ctx.body = JSON.stringify(rslt);
  }
});

router.post('/rpc', async function (ctx: any) {
  let { jsonrpc, method, params, id } = ctx.request.body;  // from bodyparser 

  if (jsonrpc != "2.0") {
    let error: Rpc.Error = { id, error: { code: -32600, message: "Invalid version" } };
    if (id) ctx.body = error;
    return;
  }

  let checkPK = (publicKey: JsonWebKey) => {
    let pk = ctx.userId.publicKey;
    if (!pk) throw new Error("missing public key from token");
    if (JSON.stringify(publicKey) !== JSON.stringify(pk)) throw new Error("Invalid publicKey submitted");
  }

  let userId = ctx.userId.id;
  try {
    switch (method as Rpc.Method) {
      case "initialize": {
        let req: Rpc.InitializeRequest = params;
        checkPK(req.publicKey)
        let usr = getUser(userId);
        if (!usr) throw new Error("Internal error getting user details");
        let redirectUrl = ctx['redirectUrl'];
        let allTags = Array.from(cache.tags);
        let result: Rpc.InitializeResponse = { ok: true, allTags, redirectUrl };
        ctx.body = { id, result };
        break;
      }
      case "promoteContent": {
        let req: Rpc.PromoteContentRequest = params;
        //let { publicKey, contentId, signature } = req;
        //checkPK(publicKey)
        //if (!validateContentSignature(publicKey, contentId.toString(), signature)) throw new Error("request failed verification");
        let usr = getUser(userId);
        let result: Rpc.PromoteContentResponse = await pg.handlePromoteContent(userId, req)
        ctx.body = { id, result };
        break;
      }
      case "promoteLink": {
        let req: Rpc.PromoteLinkRequest = params;
        let { publicKey, url, signature } = req;
        let ourl = parse(url);
        checkPK(publicKey)
        if (!validateContentSignature(publicKey, url, signature)) throw new Error("request failed verification");
        let usr = getUser(userId);
        let result: Rpc.PromoteLinkResponse = await pg.handlePromoteLink(userId, req)
        ctx.body = { id, result };
        break;
      }
      /*
      case "loadLink": {
        let req: Rpc.LoadLinkRequest = params;
        let lnk = await pg.findRootLinkForUrl(req.url);
        let result: Rpc.LoadLinkResponse = { found: false };
        if (lnk) {
          let url = cache.linkToUrl(lnk.linkId);
          let linkDepth = cache.getLinkDepth(lnk);
          let linkPromoter = cache.users.get(lnk.userId).userName;
          result = { found: true, url, linkDepth, linkPromoter };
        }
        ctx.body = { id, result };
        break;
      }
      */
      case "getRedirect": {
        let req: Rpc.GetRedirectRequest = params;
        let contentUrl = null;
        let url = parse(req.linkUrl);
        let result: Rpc.GetRedirectResponse = { found: false };
        if (Utils.isPseudoQLinkURL(url)) {
          let linkId = Utils.getLinkIdFromUrl(url);
          if (!linkId) throw new Error("invalid link");
          let link = cache.links.get(linkId);
          let cont = cache.contents.get(link.contentId)
          console.log("attention gots to get paid for!!!");
          await pg.payForView(userId, linkId)
          if (cont.contentType != "link") result = { found: false };
          else {
            let contentUrl = cont.title;
            let linkDepth = cache.getLinkDepth(link);
            let linkPromoter = cache.users.get(link.userId).userName;
            result = { found: true, contentUrl, linkDepth, linkPromoter };
          }
        }
        ctx.body = { id, result };
        break;
      }
      case "changeSettings": {
        let req: Rpc.ChangeSettingsRequest = params;
        let { userName } = req;
        let usr = getUser(userId);
        if (!usr) throw new Error("Internal error getting user details");
        if (userName && userName !== usr.userName) {
          if (await pg.checkMonikerUsed(userName)) {
            ctx.body = { id, error: { message: "Nickname not available" } };
            return;
          }
          usr = { ...usr, userName };
        }
        let updts = await pg.upsertUser(usr);
        cache.update(updts);
        let result: Rpc.ChangeSettingsResponse = { ok: true };
        ctx.body = { id, result };
        break;
      }
      case "getUserLinks": {
        //let req: Rpc.GetUserLinksRequest = params;
        let links = await pg.getUserLinks(userId);
        let promotions = await pg.deliverNewPromotions(userId);
        let connectedUsers = cache.getConnectedUserNames(userId);
        let reachableUserCount = cache.getReachableUserIds(userId).length;
        let contents = await pg.getUserContents(userId);
        let allTags = await pg.loadTags();
        let result: Rpc.GetUserLinksResponse = { links, promotions, connectedUsers, reachableUserCount, contents, allTags };
        ctx.body = { id, result };
        break;
      }
      case "redeemLink": {
        let req: Rpc.RedeemLinkRequest = params;
        let link = cache.links.get(req.linkId);
        await pg.redeemLink(link);
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
        if (content.contentId) content = await pg.updateRecord<Dbt.Content>("contents", content);
        else content = await pg.insertRecord<Dbt.Content>("contents", content);
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
        let ok = await pg.deleteRecord<Dbt.Content>("contents", content);
        let result: Rpc.RemoveContentResponse = { ok };
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


const port = parseInt(process.env.PORT, 10) || 8080;

console.log("Listening at http://localhost:" + port);
app.listen(port);





