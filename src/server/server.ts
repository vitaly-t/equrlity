
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
//import * as koastatic from 'koa2-static-files';
//import serve from './koa-static';
import * as send from 'koa-send';
import clientIP from './clientIP.js';
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';
import { capuchinVersion, isDev } from '../lib/utils';
import * as cors from 'kcors';
import * as cache from './cache';

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

//app.use(koastatic.static(__dirname + '/assets')); 
//app.use(serve("assets", "./assets"));
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

// No idea why these are necessary, but I couldn't make it work any other way ...
publicRouter.get('/download/synereo.zip', async function (ctx, next) {
  await send(ctx, './assets/synereo-plugin.zip');
});

publicRouter.get('/download/synereo.tar.gz', async function (ctx, next) {
  await send(ctx, './assets/synereo-plugin.tar.gz');
});

/* @@GS - Wasted an entire weekend trying to get the download thing to work.  Still no idea why it fails
let pluginClause = ` 
<p>You can download the latest release of our Chrome plugin by clicking either of these links:</p> 
   <p><a href="assets/synereo-plugin.zip" download >Zip file (Windows)</a></p>
   <p><a href="assets/synereo-plugin.tar.gz" download >Tar.gz file (Linux  / Mac)</a></p>
`;
*/

let pluginClause = ` 
<p>You can download the latest release of our Chrome plugin by clicking either of these links:</p> 
   <p><a href="/download/synereo.zip" download >Zip file (Windows)</a></p>
   <p><a href="/download/synereo.tar.gz" download >Tar.gz file (Linux  / Mac)</a></p>
<p>To install it you will have to unzip/untar the file into a directory, then go in to your
Chrome extensions page, and select "Load unpacked extension".</p>
<p>You may need to first tick the "Developer Mode" box (top right) to allow unpacked extensions to load. 
If you wish, you can also untick it after installing the extension.)</p>         
<p>To upgrade an existing installation, simply overwrite the existing files with the new ones, and select "Reload" in the extensions page.</p>         
`;
const header = `<h2>CALL TO ACTION - JOIN SYNEREO - YOU KNOW YOU WANT TO - WHAT COULD GO WRONG???</h2>`;
const footer = `<p>Proudly brought to you by UglyAsF*ck Interfaces Ltd. (C) 1996. All rights reserved</p>`;

publicRouter.get('/link/:id', async (ctx, next) => {
  let linkId: Dbt.linkId = parseInt(ctx.params.id);
  let url = cache.getContentFromLinkId(linkId);
  let linkClause = url ? `<p>This is the link you were (probably) after: <a href="${url}">${url}</a></p>` : '';
  ctx.body = `
${header}
<p>You have followed a Synereo link.  If you can see this message (for more than a second or so)
it probably means you do not have the Synereo browser plugin installed.</p>
${pluginClause}
${linkClause}
${footer}
`;
})

publicRouter.get('/', async (ctx, next) => {
  ctx.body = `
${header};
<p>You have landed on the home page of Synereo Chrome plugin extension.</p>
<p>(This page is currently in serious contention for the world's ugliest webpage!  Support our bid, vote for us!!! ... )</p>
${pluginClause}
${footer}
`;
})

app.use(publicRouter.routes());

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
  if (client !== 'capuchin') {
    ctx.status = 400;
    ctx.body = { error: { message: 'Invalid Client - not capuchin' } };
    return;
  }
  if (version !== capuchinVersion()) {
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

    await pg.touch_user(user.userId);
  }
});

app.use(async function (ctx, next) {
  let userId = ctx['userId'];
  if (!userId) {
    console.log("jwt returned no key");
    let user = await pg.createUser();
    ctx['userId'] = { id: user.userId };
    ctx.user = user;
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
    let error: Rpc.Error = {id, error: { code: -32600, message: "Invalid version" } };
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
        let result: Rpc.InitializeResponse = {ok: true};
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
        let result: Rpc.ChangeSettingsResponse = {ok: true};
        ctx.body = { id, result };
        break;
      }
      case "getUserLinks": {
        //let req: Rpc.GetUserLinksRequest = params;
        let links = await pg.GetUserLinks(ctx.userId.id);
        let promotions = await pg.deliver_new_promotions(ctx.userId.id);
        let connectedUsers = cache.getConnectedUserNames(ctx.userId.id);
        let reachableUserCount = cache.getReachableUserIds(ctx.userId.id).length;
        let result: Rpc.GetUserLinksResponse = { links, promotions, connectedUsers, reachableUserCount };
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





