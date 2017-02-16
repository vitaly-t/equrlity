
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
import serve from './koa-static';
import * as send from 'koa-send';
import clientIP from './clientIP.js';
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';

const cache = pg.DbCache;
const jwt_secret = process.env.JWT_AMPLITUDE_KEY;

cache.init();
//pg.resetDatabase();

const app = new Koa();
const router = new Router();

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

let getUserCount = function () {
  return cache.users.size;
};

let checkMonikerUsed = function (newName) {
  return Object.keys(cache.users).some(function (id) {
    return cache.users[id].userName === newName;
  });
};

function readFileAsync(src: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    fs.readFile(src, { 'encoding': 'utf8' }, function (err, data) {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

let createUser = async function (ctx) {
  let o = cache.users;
  let i = o.size;
  let userName = ''
  while (true) {
    userName = "anonymous_" + i;
    if (!checkMonikerUsed(userName)) break;
    ++i;
  }
  let userId = uuid.generate();
  let usr = { ...pg.emptyUser(), userId, userName };
  let user = await pg.upsert_user(usr);
  console.log("created user : " + JSON.stringify(user));
  let rslt = { id: userId };
  ctx.userId = rslt;
  ctx.user = user;
  return rslt;
};

let authent = async function (ctx, prov, authId) {
  console.log("authent call with authId : " + authId);
  if (!authId) {
    ctx.status = 401
  } else {
    console.log("authenticating for provider: " + prov);
    let user = pg.get_user_from_auth(prov, authId);
    if (user) {
      ctx.user = user;
      ctx.userId = { id: user.userId };
      if (prov !== 'ip') {
        let ip = clientIP(ctx.req);
        let auth = { ...pg.emptyAuth(), authId: 'ip:' + ip, userId: ctx.userId.id };
        await pg.upsert_auth(auth);
      }
      else pg.touch_auth(prov, authId)
    } else {
      if (!ctx.user) {
        if (prov !== 'ip') console.log("authentication problem - no previous user"); // return;  // ???
        await createUser(ctx);
      }
      user = ctx.user;
      let auth = { ...pg.emptyAuth(), authId: prov + ':' + authId, userId: ctx.userId.id }
      await pg.upsert_auth(auth);
    }
    if (prov === 'ip') delete ctx.userId.auth;
    else ctx.userId.auth = prov + ':' + authId;

    let tok = jwt.sign(ctx.userId, jwt_secret); //{expiresInMinutes: 60*24*14});
    ctx['token'] = tok;

    //await ctx.login(user);   // for when passport is enabled
  }
};

app.keys = ['foo'];

//app.use(koastatic.static(__dirname + '/assets')); 
//app.use(serve("assets", "./assets"));

app.use(bodyParser());

//app.use(session(app));
//app.use(passport.initialize());
//app.use(passport.session());
//app.use(flash());

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = 400;
    ctx.body = {
      message: 'Unhandled error',
      error: err
    };
  }
})


app.use(jwt.jwt({ secret: jwt_secret, ignoreExpiration: true, key: 'userId' }));

app.use(async function (ctx, next) {

  let userId = ctx['userId'];
  if (!userId) console.log("jwt returned no key");
  let user = userId ? getUser(userId.id) : null;
  if (userId && !user) console.log("unable to locate user for : " + userId.id);
  if (!userId || !user) {
    let ip = clientIP(ctx.req);
    await authent(ctx, 'ip', ip);
  }

  await next();
  userId = ctx['userId'];
  user = getUser(userId.id);
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Headers", ["X-Requested-With", "Content-Type", "Authorization"]);
  ctx.set("Access-Control-Expose-Headers", ["x-syn-moniker", "x-syn-credits", "x-syn-token", "x-syn-authprov", "x-syn-groups"]);
  ctx.set("Access-Control-Allow-Methods", "HEAD, PUT, GET, POST, DELETE, OPTIONS");
  ctx.set('x-syn-credits', user.ampCredits.toString());
  ctx.set('x-syn-moniker', user.userName);

  if (userId.auth) {
    let auth = userId.auth;
    let prov = auth.slice(0, auth.indexOf(':'));
    let grps = ctx.user.groups || '';
    ctx.set('x-syn-authprov', prov);
    ctx.set('x-syn-groups', grps);
  }
  pg.touch_user(userId.id);
});

/* @@GS - Wasted an entire weekend trying to get the download thing to work.  Still no idea why it fails
let pluginClause = ` 
<p>You can download the latest release of our Chrome plugin by clicking either of these links:</p> 
   <p><a href="assets/synereo-plugin.zip" download >Zip file (Windows)</a></p>
   <p><a href="assets/synereo-plugin.tar.gz" download >Tar.gz file (Linux  / Mac)</a></p>
<p>To install it you will have to unzip/untar the file into a directory, then go in to your
Chrome extensions page, and select "Load unpacked extension".</p>
<p>You may need to first tick the "Developer Mode" box (top right) to allow unpacked extensions to load. 
If you wish, you can also untick it after installing/upgrading the extension.
</p>         
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

router.get('/link/:id', async (ctx, next) => {
  let linkId: Dbt.linkId = parseInt(ctx.params.id);
  let url = cache.getContentFromLinkId(linkId);
  let body = `
<h2>CALL TO ACTION - JOIN SYNEREO - YOU KNOW YOU WANT TO - WHAT COULD GO WRONG???</h2>
<p>You have followed a Synereo link.  If you can see this message (for more than a second or so)
it probably means you do not have the Synereo browser plugin installed.
</p>
`;
  body += pluginClause;
  if (url) body += `<p>This is the link you were (probably) after: <a href="${url}">${url}</a></p>`
  ctx.body = body;
})

async function handleAddContent(userId, {publicKey, content, signature, amount}): Promise<Rpc.SendAddContentResponse> {
  let link = cache.getLatestLinkFromContentId(content);
  if (link) {
    return { prevLink: cache.linkToUrl(link.linkId) } as Rpc.AddContentAlreadyRegistered;
  }
  link = await pg.insert_content(userId, content, amount);
  return { link: cache.linkToUrl(link.linkId) } as Rpc.AddContentOk;
}

async function handleAmplify(userId, {publicKey, content, signature, amount}): Promise<Rpc.AddContentOk> {
  let linkId = cache.getLinkIdFromUrl(parse(content));
  let link = cache.links.get(linkId);
  if (link.userId == userId) {
    await pg.transfer_link_to_user(link, -amount);
  }
  else {
    let contentId = cache.getContentIdFromContent(content);
    let prevId = cache.getLinkAlreadyInvestedIn(userId, contentId);
    if (prevId) throw new Error("user has previously invested in this content");
    await pg.amplify_content(userId, content, amount);  
  }
  return { link: cache.linkToUrl(link.linkId) };
}

async function changeMoniker(id: Dbt.userId, newName: string): Promise<boolean> {
  console.log("setting new Moniker : " + newName);
  if (checkMonikerUsed(newName)) return false;
  let prv = cache.users[id];
  let usr = { ...prv, userName: newName };
  console.log("updating user : " + JSON.stringify(usr));
  let updt = await pg.upsert_user(usr);
  console.log("user updated : " + JSON.stringify(updt));
  cache.users.set(id, usr);
  return true;
}

router.post('/rpc', async function (ctx: any) {
  let {jsonrpc, method, params, id} = ctx.request.body;  // from bodyparser 
  if (!ctx.header.authorization) {
    //@@GS - I was unable to get the plugin popup to use cookies properly
    // so instead we send the token as a header.
    // on receipt we will get an Authorization: Bearer header from rpc calls.
    // unfortunately, other routes will now have to manage without use of cookies.
    console.log("sending token");
    ctx.set('x-syn-token', ctx['token']);
  }

  if (jsonrpc != "2.0") {
    if (id) ctx.body = { id, error: { code: -32600, message: "Invalid version" } };
    return;
  }
  try {
    switch (method as Rpc.Method) {
      case "initialize": {
        // data goes back through the headers.
        let {publicKey} = params
        let usr = getUser(ctx.userId.id);
        if (!usr) throw new Error("Internal error getting user details");
        usr = { ...usr, publicKey };
        await pg.upsert_user(usr);
        ctx.body = { id, ok: true };
        break;
      }
      case "addContent": {
        let url = parse(params.content);
        let result = null;
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
          result = await handleAmplify(ctx.userId.id, params)
        }
        else {
          result = await handleAddContent(ctx.userId.id, params)
        }
        ctx.body = { id, result }
        break;
      }
      case "changeMoniker": {
        let newName = ctx.body.userName;  // from bodyparser 
        let ok = await changeMoniker(ctx.userId.id, newName);
        if (ok) ctx.body = { id, result: { ok: true } };
        else ctx.body = { id, error: { message: "taken" } };
        break;
      }
      case "loadLinks": {
        let links = cache.getChainFromContent(params.url);
        let result: Rpc.LoadLinksResponse = links.map(lnk => {
          let url = cache.linkToUrl(lnk.linkId)
          let item: Rpc.LoadLinksResponseItem = { url, hitCount: lnk.hitCount, amount: lnk.amount }
          return item;
        });
        ctx.body = { id, result };
        break;
      }
      case "getRedirect": {
        let contentUrl = null;
        let url = parse(params.linkUrl);
        if (cache.isSynereo(url)) {
          let linkId = cache.getLinkIdFromUrl(url);
          if (linkId) {
            contentUrl = cache.getContentFromLinkId(linkId);
            console.log("attention gots to get paid for!!!");
            await cache.payForView(ctx.userId.id, linkId)
          }
        }
        ctx.body = contentUrl ? { id, result: { contentUrl } } : { id, error: { message: "invalid link" } }
        break;
      }
      case "changeSettings": {
        let {moniker, deposit, email} = params;
        let usr = getUser(ctx.userId.id);
        if (!usr) throw new Error("Internal error getting user details");
        if (moniker && moniker !== usr.userName) {
          if (checkMonikerUsed(moniker)) {
            ctx.body = { id, error: { message: "Nickname not available" } };
            return;
          }
          usr = { ...usr, userName: moniker };
        }
        let idep = parseInt(deposit);
        if (idep > 0) {
          let ampCredits = usr.ampCredits + idep;
          usr = { ...usr, ampCredits };
        }
        if (email) usr = { ...usr, email };
        await pg.upsert_user(usr);
        ctx.body = { id, result: { ok: true } };
        break;
      }
      default:
        if (id) ctx.body = { id, error: { code: -32601, message: "Invalid method: " + method } };
    }
  }
  catch (e) {
    ctx.body = { id, error: { message: e.message } };
  }

});

// No idea why these are necessary, but I couldn't make it work any other way ...
router.get('/download/synereo.zip', async function (ctx, next) {
  await send(ctx, './assets/synereo-plugin.zip');
});

router.get('/download/synereo.tar.gz', async function (ctx, next) {
  await send(ctx, './assets/synereo-plugin.tar.gz');
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

router.all('*', async (ctx, next) => {
  let body = `
<h2>CALL TO ACTION - JOIN SYNEREO - YOU KNOW YOU WANT TO - WHAT COULD GO WRONG???</h2>
<p>You have landed on the home page of Synereo Chrome plugin extension.</p>
<p>(This page is currently in serious contention for the world's ugliest webpage!  Support our bid, vote for us!!! ... )</p>
`
  body += pluginClause;
  ctx.body = body;
})

app.use(router.routes())
app.use(router.allowedMethods());


const port = parseInt(process.env.PORT, 10) || 8080;

console.log("Listening at http://localhost:" + port);
app.listen(port);





