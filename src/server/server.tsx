
import { promisify } from '../lib/promisify';
import * as fs from "fs"
import * as pg from './pgsql';
import * as Dbt from '../lib/datatypes'
import * as Koa from "koa";
import * as bodyParser from 'koa-bodyparser';
import * as session from 'koa-session';
import * as Router from 'koa-router';
import * as OxiDate from '../lib/oxidate';
import * as uuid from '../lib/uuid.js';
import * as jwt from './jwt';
//import passport from './auth';
import {serve} from './koa-static';
import * as send from 'koa-send';
import clientIP from './clientIP.js';
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';
import { capuchinVersion, isDev } from '../lib/utils';
import * as cors from 'kcors';
import * as cache from './cache';
import * as Remarkable from 'remarkable';
const md = new Remarkable({ html: true });

// server-side rendering a bust - boo-hoo!
import * as React from 'react';
//import * as ReactDOM from 'react-dom';
import * as ReactDOMServer from 'react-dom/server'
import { PostView } from '../lib/postview';
import { LinkLandingPage, HomePage } from '../lib/landingPages';

const jwt_secret = process.env.JWT_AMPLITUDE_KEY;

pg.init();
//pg.resetDataTables();
//pg.recreateDataTables();

function isMember(grp: string, ctx: Koa.Context): boolean {
  let grps = ctx.user.groups;
  return grps && grps.indexOf(grp + ',') >= 0;
}

let strToDate = function (cdt: string): Date {
  return OxiDate.parse(cdt, 'yyyyMMdd');
};

function getUser(id: Dbt.userId): Dbt.User {
  return cache.users.get(id);
};

function readFileAsync(src: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    fs.readFile(src, { 'encoding': 'utf8' }, function (err, data) {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

/*
let authent = async function (ctx, prov, authId) {
  console.log("authent call with authId : " + authId);
  if (!authId) {
    ctx.status = 403
  } else {
    console.log("authenticating for provider: " + prov);
    let user = pg.get_user_from_auth(prov, authId);
    if (user) {
      ctx.user = user;
      ctx.userId = { id: user.userId };
      if (prov !== 'ip') {
        let ip = clientIP(ctx.req);
        let auth = { ...pg.emptyAuth(), authProvider: 'ip', authId: ip, userId: ctx.userId.id };
        await pg.upsert_auth(auth);
      }
      else pg.touch_auth(prov, authId)
    } else {
      if (!ctx.user) {
        if (prov !== 'ip') console.log("authentication problem - no previous user"); // return;  // ???
        await createUser(ctx);
      }
    }
    if (prov === 'ip') delete ctx.userId.auth;
    else ctx.userId.auth = prov + ':' + authId;

    let tok = jwt.sign(ctx.userId, jwt_secret); //{expiresInMinutes: 60*24*14});
    ctx['token'] = tok;

    //await ctx.login(user);   // for when passport is enabled
  }
};
*/

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
    exposeHeaders: ["x-syn-moniker", "x-syn-credits", "x-syn-token", "x-syn-authprov", "x-syn-groups"],
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
  let body = html.replace('{{{__BODY__}}}', ins)
  ctx.body = body;

})

publicRouter.get('/post/:id', async (ctx, next) => {
  let postId = parseInt(ctx.params.id);
  let post = await pg.retrieveRecord<Dbt.Post>("posts", { postId })
  let view = <PostView post={post} />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let html = await readFileAsync('./assets/index.htmpl');
  let body = html.replace('{{{__BODY__}}}', ins)
  ctx.body = body;
})

// need to serve this route before static files are enabled
publicRouter.get('/', async (ctx, next) => {
  let view = <HomePage />;
  let ins = ReactDOMServer.renderToStaticMarkup(view);
  let html = await readFileAsync('./assets/index.htmpl');
  let body = html.replace('{{{__BODY__}}}', ins)
  ctx.body = body;

})

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
})

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
  if (client === 'capuchin' && version !== capuchinVersion()) {
    ctx.status = 400;
    ctx.body = { error: { message: 'Client is out-of-date and requires upgrade' } };
    return;
  }
  await next();
});

app.use(jwt.jwt({ secret: jwt_secret, ignoreExpiration: true, key: 'userId' }));

app.use(async function (ctx, next) {
  await next();

  let user: Dbt.User = getUser(ctx['userId'].id);
  if (user) {
    //console.log("Setting credits to : " + user.ampCredits.toString());
    ctx.set('x-syn-credits', user.ampCredits.toString());
    ctx.set('x-syn-moniker', user.userName);
    await pg.touch_user(user.userId, clientIP(ctx));
  }
});

app.use(async function (ctx, next) {
  let userId = ctx['userId'];
  if (!userId) {
    console.log("jwt returned no key");
    let ipAddress = clientIP(ctx);
    let user = await pg.createUser(ipAddress);
    ctx['userId'] = { id: user.userId };
    ctx.user = user;
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
    ctx.user = user;
  }
  ctx['token'] = jwt.sign(ctx['userId'], jwt_secret); //{expiresInMinutes: 60*24*14});
  await next();
});


/*
app.use(async function (ctx, next) {
//  Julia! - authentication / passport stuff should go here.  The identification stuff has been handled above
// and the context now contains both userId and user

await next()
if (cxt.auth) {
  let auth = cxt.auth;
  let prov = auth.slice(0, auth.indexOf(':'));
  let grps = ctx.user.groups || '';
  ctx.set('x-syn-authprov', prov);
  ctx.set('x-syn-groups', grps);
}
*/

const router = new Router();
router.post('/rpc', async function (ctx: any) {
  let {jsonrpc, method, params, id} = ctx.request.body;  // from bodyparser 
  if (!ctx.header.authorization) {
    console.log("sending token");
    ctx.set('x-syn-token', ctx['token']);
  }

  if (jsonrpc != "2.0") {
    let error: Rpc.Error = { id, error: { code: -32600, message: "Invalid version" } };
    if (id) ctx.body = error;
    return;
  }

  try {
    switch (method as Rpc.Method) {
      case "initialize": {
        let req: Rpc.InitializeRequest = params;
        let {publicKey} = req;
        let usr = getUser(ctx.userId.id);
        if (!usr) throw new Error("Internal error getting user details");
        usr = { ...usr, publicKey };
        await pg.upsert_user(usr);
        let redirectUrl = ctx['redirectUrl'];
        let result: Rpc.InitializeResponse = { ok: true, redirectUrl };
        ctx.body = { id, result };
        break;
      }
      case "addContent": {
        let req: Rpc.AddContentRequest = params;
        let url = parse(req.content);
        let result: Rpc.SendAddContentResponse = null;
        let {publicKey: any} = params;
        let usr = getUser(ctx.userId.id);
        /*  Julia - help!!!
        if (usr.publicKey) {
          if (usr.publicKey !== publicKey) throw new Error("Invalid public key supplied");
        }
        else {
          usr = { ...usr, publicKey };
          await pg.upsert_user(usr);
        }
        */
        if (cache.isSynereo(url)) {
          result = await pg.handleAmplify(ctx.userId.id, params)
        }
        else {
          result = await pg.handleAddContent(ctx.userId.id, params)
        }
        ctx.body = { id, result }
        break;
      }
      case "loadLink": {
        let req: Rpc.LoadLinkRequest = params;
        let lnk = await pg.getLinkFromContent(req.url);
        if (!lnk) {
          let result: Rpc.LoadLinkResponse = { found: false }
          ctx.body = { id, result };
          return;
        }
        let url = cache.linkToUrl(lnk.linkId)
        let linkDepth = cache.getLinkDepth(lnk);
        let linkAmplifier = cache.users.get(lnk.userId).userName
        let result: Rpc.LoadLinkResponse = { found: true, url, linkDepth, linkAmplifier }
        ctx.body = { id, result };
        break;
      }
      case "getRedirect": {
        let req: Rpc.GetRedirectRequest = params;
        let contentUrl = null;
        let url = parse(req.linkUrl);
        if (cache.isSynereo(url)) {
          let linkId = cache.getLinkIdFromUrl(url);
          if (!linkId) throw new Error("invalid link");
          let ip = clientIP(ctx);
          cache.cancelPossibleInvitation(ip);
          if (!(await pg.has_viewed(ctx.userId.id, linkId))) {
            console.log("attention gots to get paid for!!!");
            await pg.payForView(ctx.userId.id, linkId)
          }
          contentUrl = cache.getContentFromLinkId(linkId);
          let link = cache.links.get(linkId);
          let linkDepth = cache.getLinkDepth(link)
          let linkAmplifier = cache.users.get(link.userId).userName;
          let result: Rpc.GetRedirectResponse = { found: true, contentUrl, linkDepth, linkAmplifier };
          ctx.body = { id, result };
          break;
        }
        let result: Rpc.GetRedirectResponse = { found: false };
        ctx.body = { id, result }
        break;
      }
      case "changeSettings": {
        let req: Rpc.ChangeSettingsRequest = params;
        let {moniker, deposit, email} = req;
        let usr = getUser(ctx.userId.id);
        if (!usr) throw new Error("Internal error getting user details");
        if (moniker && moniker !== usr.userName) {
          if (await pg.checkMonikerUsed(moniker)) {
            ctx.body = { id, error: { message: "Nickname not available" } };
            return;
          }
          usr = { ...usr, userName: moniker };
        }
        if (deposit > 0) {
          let ampCredits = usr.ampCredits + deposit;
          usr = { ...usr, ampCredits };
        }
        if (email) usr = { ...usr, email };
        await pg.upsert_user(usr);
        let result: Rpc.ChangeSettingsResponse = { ok: true };
        ctx.body = { id, result };
        break;
      }
      case "getUserLinks": {
        //let req: Rpc.GetUserLinksRequest = params;
        let uid = ctx.userId.id
        let links = await pg.GetUserLinks(uid);
        let promotions = await pg.deliver_new_promotions(uid);
        let connectedUsers = cache.getConnectedUserNames(uid);
        let reachableUserCount = cache.getReachableUserIds(uid).length;
        let posts = await pg.GetUserPosts(uid);
        let result: Rpc.GetUserLinksResponse = { links, promotions, connectedUsers, reachableUserCount, posts };
        ctx.body = { id, result };
        break;
      }
      case "redeemLink": {
        let req: Rpc.RedeemLinkRequest = params;
        let link = cache.links.get(req.linkId);
        await pg.redeem_link(link)
        let links = await pg.GetUserLinks(ctx.userId.id);
        let result: Rpc.RedeemLinkResponse = { links };
        ctx.body = { id, result };
        break;
      }
      case "getPostBody": {
        let req: Rpc.GetPostBodyRequest = params;
        let body = await pg.GetPostBody(req.postId);
        let result: Rpc.GetPostBodyResponse = { body };
        ctx.body = { id, result };
        break;
      }
      case "savePost": {
        let req: Rpc.SavePostRequest = params;
        await pg.SavePost(ctx.userId.id, req);
        let posts = await pg.GetUserPosts(ctx.userId.id);
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





