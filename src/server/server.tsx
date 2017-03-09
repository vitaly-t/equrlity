import * as dotenv from 'dotenv-safe';
let env = dotenv.load();
console.log("dotenv loaded");

// internal node
import * as fs from "fs"
import { Url, parse } from 'url';

// node_modules
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server'
import * as Remarkable from 'remarkable';
import axios from 'axios';

import * as Koa from "koa";
import * as bodyParser from 'koa-bodyparser';
import * as Router from 'koa-router';
import * as send from 'koa-send';
import * as cors from 'kcors';

// lib
import * as OxiDate from '../lib/oxidate';
import * as uuid from '../lib/uuid.js';
import { promisify } from '../lib/promisify';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes'
import * as Rpc from '../lib/rpc';
import { PostView } from '../lib/postview';
import { LinkLandingPage, HomePage } from '../lib/landingPages';
import { validateContentSignature } from '../lib/Crypto';


// local
import * as jwt from './jwt';
import { serve } from './koa-static';
import clientIP from './clientIP.js';
import * as pg from './pgsql';
import * as cache from './cache';

const md = new Remarkable({ html: true });
const jwt_secret = process.env.JWT_AMPLITUDE_KEY;

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

const app = new Koa();
app.keys = ['amplitude'];  //@@GS what does this do again?

const publicRouter = new Router();

//app.use(session(app));
//app.use(passport.initialize());
//app.use(passport.session());
//app.use(flash());

app.use(bodyParser());

app.use(
  cors({
    origin: "*",
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
    allowHeaders: ["X-Requested-With", "Content-Type", "Authorization", "x-syn-client-version"],
    exposeHeaders: ["x-syn-token", "x-syn-moniker", "x-syn-email", "x-syn-credits", "x-syn-groups"],
  })
);

// These are necessary because we are not serving static files yet.
publicRouter.get('/download/synereo.zip', async function (ctx, next) {
  await send(ctx, './assets/synereo-plugin.zip');
});

publicRouter.get('/download/synereo.tar.gz', async function (ctx, next) {
  await send(ctx, './assets/synereo-plugin.tar.gz');
});


publicRouter.get('/link/:id', async (ctx, next) => {
  let linkId: Dbt.linkId = parseInt(ctx.params.id);
  let url = cache.getContentFromLinkId(linkId);
  let ip = clientIP(ctx);
  cache.registerPossibleInvitation(ip, linkId);
  // logic: if invitation is still there in 1 second it wasn't a redirect
  setTimeout(() => {
    if (cache.isPossibleInvitation(ip, linkId)) pg.registerInvitation(ip, linkId);
  }, 1000);

  let view = <LinkLandingPage url={url} />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let html = await readFileAsync('./assets/index.htmpl');
  let body = html.replace('{{{__BODY__}}}', ins);
  ctx.body = body;

});

publicRouter.get('/post/:id', async (ctx, next) => {
  let postId = parseInt(ctx.params.id);
  let post = await pg.retrieveRecord<Dbt.Post>("posts", { postId });
  let creator = cache.users.get(post.userId).userName;
  let view = <PostView post={post} creator={creator} />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let html = await readFileAsync('./assets/index.htmpl');
  let body = html.replace('{{{__BODY__}}}', ins);
  ctx.body = body;
});

// need to serve this route before static files are enabled
publicRouter.get('/', async (ctx, next) => {
  let view = <HomePage />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let html = await readFileAsync('./assets/index.htmpl');
  let body = html.replace('{{{__BODY__}}}', ins);
  ctx.body = body;

});

publicRouter.post('/auth', async (ctx) => {
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
    let user = await pg.getUserByAuthId(authId, "chrome");  //@@GS - pretty sure this should just be "google" - no need for "chrome"
    if (!user) {
      user = await pg.createUser(email);
      await pg.createAuth(authId, user.userId, "chrome");
    }
    let id = user.userId;
    let token = jwt.sign({ id, publicKey, email }, jwt_secret);
    ctx.body = { jwt: token };
  }
  else ctx.throw(401, "Authentication failed!");
});

app.use(publicRouter.routes());

// currently this needs to come after the public routes
app.use(serve("assets", "./assets"));

//app.use(publicRouter.allowedMethods());

//  From here on, it's for known client(s) only

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = 500;
    ctx.body = { error: { message: 'Unhandled error on Server : ' + err.message } };
  }
});

app.use(async (ctx, next) => {
  let client_ver = ctx.headers['x-syn-client-version'];
  if (!client_ver) {
    ctx.status = 400;
    ctx.body = { error: { message: 'Invalid Client - missing header' } };
    return;
  }
  let [client, version] = client_ver.split("-");
  if (client !== 'capuchin' && client !== 'lizard') {
    ctx.status = 400;
    ctx.body = { error: { message: 'Unknown Client' } };
    return;
  }
  if (client === 'capuchin' && version !== Utils.capuchinVersion()) {
    ctx.status = 400;
    ctx.body = { error: { message: 'Client is out-of-date and requires upgrade' } };
    return;
  }
  await next();
});

app.use(jwt.jwt({ secret: jwt_secret, ignoreExpiration: true, key: 'userId' }));

app.use(async function (ctx, next) {
  let _userId = { ...ctx['userId'] };
  await next();

  let userId = ctx['userId'];
  let user: Dbt.User = getUser(userId.id);
  if (!user) throw new Error("system corruption detected");
  let { publicKey, email, id } = userId;
  if (!_userId || _userId.publicKey !== publicKey || _userId.email !== email || _userId.id !== id) {
    let token = jwt.sign(userId, jwt_secret); //{expiresInMinutes: 60*24*14});
    console.log("sending token");
    ctx.set('x-syn-token', token);
  }
  ctx.set('x-syn-credits', user.credits.toString());
  ctx.set('x-syn-moniker', user.userName);
  ctx.set('x-syn-email', email);
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

const router = new Router();
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
        let result: Rpc.InitializeResponse = { ok: true, redirectUrl };
        ctx.body = { id, result };
        break;
      }
      case "addContent": {
        let req: Rpc.AddContentRequest = params;
        let { publicKey, content, signature } = req;
        let url = parse(content);
        checkPK(publicKey)
        if (!validateContentSignature(publicKey, content, signature)) throw new Error("request failed verification");
        let usr = getUser(userId);
        let hndlr: Rpc.Handler<Rpc.AddContentRequest, Rpc.SendAddContentResponse> = async (req) => {
          if (Utils.isSynereo(url)) return await pg.handleAmplify(userId, req)
          return await pg.handleAddContent(userId, req)
        }
        let result = await handleRequest(hndlr, req);
        ctx.body = { id, result };
        break;
      }
      case "loadLink": {
        let req: Rpc.LoadLinkRequest = params;
        let lnk = await pg.getLinkFromContent(req.url);
        if (!lnk) {
          let result: Rpc.LoadLinkResponse = { found: false };
          ctx.body = { id, result };
          return;
        }
        let url = cache.linkToUrl(lnk.linkId);
        let linkDepth = cache.getLinkDepth(lnk);
        let linkAmplifier = cache.users.get(lnk.userId).userName;
        let result: Rpc.LoadLinkResponse = { found: true, url, linkDepth, linkAmplifier };
        ctx.body = { id, result };
        break;
      }
      case "getRedirect": {
        let req: Rpc.GetRedirectRequest = params;
        let contentUrl = null;
        let url = parse(req.linkUrl);
        if (Utils.isSynereo(url)) {
          let linkId = Utils.getLinkIdFromUrl(url);
          if (!linkId) throw new Error("invalid link");
          let ip = clientIP(ctx);
          cache.cancelPossibleInvitation(ip);
          if (!(await pg.hasViewed(userId, linkId))) {
            console.log("attention gots to get paid for!!!");
            await pg.payForView(userId, linkId)
          }
          contentUrl = cache.getContentFromLinkId(linkId);
          let link = cache.links.get(linkId);
          let linkDepth = cache.getLinkDepth(link);
          let linkAmplifier = cache.users.get(link.userId).userName;
          let result: Rpc.GetRedirectResponse = { found: true, contentUrl, linkDepth, linkAmplifier };
          ctx.body = { id, result };
          break;
        }
        let result: Rpc.GetRedirectResponse = { found: false };
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
        let posts = await pg.getUserPosts(userId);
        let result: Rpc.GetUserLinksResponse = { links, promotions, connectedUsers, reachableUserCount, posts };
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
      case "getPostBody": {
        let req: Rpc.GetPostBodyRequest = params;
        let body = await pg.getPostBody(req.postId);
        let result: Rpc.GetPostBodyResponse = { body };
        ctx.body = { id, result };
        break;
      }
      case "savePost": {
        let req: Rpc.SavePostRequest = params;
        await pg.savePost(userId, req);
        let posts = await pg.getUserPosts(userId);
        let result: Rpc.SavePostResponse = { posts };
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



app.use(router.routes())
app.use(router.allowedMethods());


const port = parseInt(process.env.PORT, 10) || 8080;

console.log("Listening at http://localhost:" + port);
app.listen(port);





