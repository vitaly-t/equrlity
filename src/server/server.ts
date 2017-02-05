
import { promisify } from '../lib/promisify';
import * as fs from "fs"
import * as pg from './pgsql';
import * as Dbt from '../lib/datatypes'
import * as Koa from "koa";
import * as bodyParser from 'koa-bodyparser';
import * as session from 'koa-session';
import * as Router from 'koa-router';
import * as OxiDate from '../lib/oxidate.js';
import * as uuid from '../lib/uuid.js';
import * as jwt from '../lib/jwt';
//import passport from './auth';
import koastatic from './koa-static';
import clientIP from './clientIP.js';

const cache = pg.DbCache;
const jwt_secret = process.env.JWT_SECRET_KEY;

cache.init();

const app = new Koa();
const router = new Router();

function isMember(grp: string, ctx: Koa.Context): boolean {
  let grps = ctx.user.groups;
  return grps && grps.indexOf(grp + ',') >= 0;
}

let strToDate = function (cdt: string): Date {
  return OxiDate.parse(cdt, 'yyyyMMdd');
};

function getUser(id: number): Dbt.User {
  return cache.users[id];
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
  //console.log("user count : "+o.count);
  //console.log(JSON.stringify(userId));
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
  let tok = jwt.sign(rslt, jwt_secret); //{expiresInMinutes: 60*24*14});
  ctx.cookies.set('syn_user', tok);
  return rslt;
};

let authent = async function (ctx, prov, authId) {
  console.log("authId : " + authId);
  if (!authId) {
    ctx.status = 401
  } else {
    console.log("callback authenticated " + prov);
    let user = pg.get_user_from_auth(prov, authId);
    if (user) {
      ctx.user = user;
      ctx.userId = { id: user.userId };
      if (prov !== 'ip') {
        let ip = clientIP(ctx.req);
        console.log("uuid : " + ctx.userId.id);
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
      console.log("create auth for : " + user.userName);
      let auth = { ...pg.emptyAuth(), authId: prov + ':' + authId, userId: ctx.userId.id }
      await pg.upsert_auth(auth);
    }
    if (prov === 'ip') delete ctx.userId.auth;
    else ctx.userId.auth = prov + ':' + authId;

    let tok = jwt.sign(ctx.userId, jwt_secret); //{expiresInMinutes: 60*24*14});
    ctx.cookies.set('syn_user', tok);
    await ctx.login(user);
    //ctx.body = {ok: true};
    //ctx.redirect('/');

  }
};

app.keys = ['foo'];

let serve = koastatic("./assets", { defer: true });
app.use(serve); ///public"));

app.use(bodyParser());
//app.use(session(app));

//app.use(passport.initialize());
//app.use(passport.session());
//app.use(flash());

app.use(jwt.jwt({ secret: jwt_secret, cookie: 'syn_user', ignoreExpiration: true, passthrough: true, key: 'userId' }));

app.use(async function (ctx, next) {
  //console.log(ctx.path + " requested");

  let userId = ctx['userId'];
  if (!userId) {
    let ip = clientIP(ctx.req);
    await authent(ctx, 'ip', ip);
    userId = ctx['userId'];
  }

  await next();
  //console.log("setting moniker : "+ ctx.user.userName);
  let user = getUser(userId.id)
  ctx.set('X-syn-moniker', user ? user.userName : 'anonymous');
  if (userId.auth) {
    let auth = userId.auth;
    let prov = auth.slice(0, auth.indexOf(':'));
    let grps = ctx.user.groups || '';
    //console.log("setting provider : "+ prov);
    ctx.set('X-syn-authprov', prov);
    //console.log("setting groups : "+ grps);
    ctx.set('X-syn-groups', grps);
    pg.touch_user(userId.id);
  }
});

router.get('/link/:id', async (ctx, next) => {
  let linkId = ctx.params.id;
  let url = cache.getContentFromLink(linkId);
  ctx.body = `
<h2>CALL TO ACTION - JOIN SYNEREO - YOU KNOW YOU WANT TO - WHAT COULD GO WRONG???</h2>
<p>You have followed a Synereo link.  If you can see this message (for more than a second or so)
it probably means you do not have the Synereo browser plugin installed.
</p>` 
  + url ? `<p>This is the <a href="${url}">content link</a>you may have <i>thought</i> you were following ;-).</p>` 
        : ``;
})

export type Method = "addContent" | "amplify"

async function handleAddContent(userId, {publicKey, content, signature}): Promise<string | Error> {
  if (cache.isContentKnown(content)) return new Error("content already registered");
  let link = await pg.insert_content(userId, content);   // need to handle errors properly here.
  return cache.linkToUri(link.linkId);
}

function handleAmplify({publicKey, content, signature}): string {
  return "dummy"
}

router.post('/rpc', async function (ctx) {
  let {jsonrpc, method, params, id} = ctx.request.body;  // from bodyparser 
  if (jsonrpc != "2.0") {
    if (id) ctx.body = {id, error: {code: -32600, message: "Invalid version"}};
    return;
  }
  switch (method as Method) {
    case "addContent": {  
      let result = await handleAddContent(ctx.user.userId, params)
      ctx.body = {id, result}
      break;
    }
    case "amplify": {
      let result = handleAmplify(params)
      //ctx.body = {id, result}
      break;
    }
    default:
      if (id) ctx.body = {id, error: {code: -32601, message: "Invalid method"}};
  }

});

router.post('/newMoniker', async (ctx, next) => {
  let newName = ctx.request.body.userName;  // from bodyparser 
  console.log("setting new Moniker : " + newName);
  console.log("for user " + JSON.stringify(ctx.user));
  let id = ctx['userId'].id;
  if (checkMonikerUsed(newName)) ctx.body = { ok: false, msg: "taken" };
  else {
    let prv = cache.users[id];
    let usr = { ...prv, userName: newName };
    console.log("updating user : " + JSON.stringify(usr));
    let updt = await pg.upsert_user(usr);
    console.log("user updated : " + JSON.stringify(updt));
    cache.users.set(id, usr);
    ctx.body = { ok: true };
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





