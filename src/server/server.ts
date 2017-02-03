import { promisify } from '../lib/promisify';

import * as fs from "fs"

import * as pg from './pgsql';
pg.init();

import * as Koa from "koa";
import * as bodyParser from 'koa-bodyparser';
import * as session from 'koa-session';
import * as Router from 'koa-router';

import * as OxiDate from '../lib/oxidate.js';

import * as uuid from '../lib/uuid.js';
import * as jwt from '../lib/jwt';

import passport from './auth';

const jwt_secret = process.env.JWT_SECRET_KEY;

import koastatic from './koa-static';
import clientIP from './clientIP.js';

const app = new Koa();
const router = new Router();

function isMember(grp: string, ctx: Koa.Context): boolean {
  let grps = ctx.user.groups;
  return grps && grps.indexOf(grp + ',') >= 0;
}

let strToDate = function (cdt: string): Date {
  return OxiDate.parse(cdt, 'yyyyMMdd');
};

let getUser = function (id) {
  return pg.users[id];
};

let getUserCount = function () {
  return pg.users.size;
};

let checkMonikerUsed = function (newName) {
  return Object.keys(pg.users).some(function (id) {
    return pg.users[id].userName === newName;
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
  let o = pg.users;
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
  ctx.cookies.set('psq_user', tok);
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
    ctx.cookies.set('psq_user', tok);
    await ctx.login(user);
    //ctx.body = {ok: true};
    //ctx.redirect('/');

  }
};

app.keys = ['foo'];

let serve = koastatic("./assets", { defer: true });
app.use(serve); ///public"));

app.use(bodyParser());
app.use(session(app));

app.use(passport.initialize());
app.use(passport.session());
//app.use(flash());

app.use(jwt.jwt({ secret: jwt_secret, cookie: 'amp_user', ignoreExpiration: true, passthrough: true, key: 'userId' }));

app.use(async function (ctxt, next) {
  //console.log(ctx.path + " requested");

  let userId = ctxt['userId'];
  if (!userId) {
    let ip = clientIP(ctxt.req);
    await authent(ctxt, 'ip', ip);
    userId = ctxt['userId'];
  }
  else ctxt['user'] = getUser(userId.id);

  await next();
  //console.log("setting moniker : "+ ctx.user.userName);
  ctxt.set('X-psq-moniker', ctxt.user ? ctxt.user.userName : 'anonymous');
  if (userId.auth) {
    let auth = userId.auth;
    let prov = auth.slice(0, auth.indexOf(':'));
    let grps = ctxt.user.groups || '';
    //console.log("setting provider : "+ prov);
    ctxt.set('X-psq-authprov', prov);
    //console.log("setting groups : "+ grps);
    ctxt.set('X-psq-groups', grps);
    pg.touch_user(userId.id);
  }
});

export type Method = "addContent" | "amplify"

function handleAddContent({publicKey, content, signature}): string {
  return "dummy"
}

function handleAmplify({publicKey, content, signature}): string {
  return "dummy"
}

router.post('/rpc', async function (ctx, next) {
  let {jsonrpc, method, params, id} = ctx.request.body;  // from bodyparser 
  if (jsonrpc != "2.0") {
    if (id) ctx.body = {id, error: {code: -32600, message: "Invalid version"}};
    return;
  }
  switch (method as Method) {
    case "addContent": {  
      let result = handleAddContent(params)
      ctx.body = {id, result}
      break;
    }
    case "amplify": {
      let result = handleAddContent(params)
      ctx.body = {id, result}
      break;
    }
    default:
      if (id) ctx.body = {id, error: {code: -32601, message: "Invalid method"}};
  }

});

router.post('/newMoniker', async function (ctx, next) {
  let newName = ctx.request.body.userName;  // from bodyparser 
  console.log("setting new Moniker : " + newName);
  console.log("for user " + JSON.stringify(ctx.user));
  let id = ctx['userId'].id;
  if (checkMonikerUsed(newName)) ctx.body = { ok: false, msg: "taken" };
  else {
    let prv = pg.users[id];
    let usr = { ...prv, userName: newName };
    console.log("updating user : " + JSON.stringify(usr));
    let updt = await pg.upsert_user(usr);
    console.log("user updated : " + JSON.stringify(updt));
    pg.users.set(id, usr);
    ctx.body = { ok: true };
  }
});

router.get('/auth/facebook', function (ctx, next) {
  passport.authenticate('facebook')
});

router.get('/auth/facebook/callback', async function (ctx, next) {
  return passport.authenticate('facebook', async function (err, authId, info, status) {
    await authent(ctx, 'facebook', authId);
    ctx.body = { ok: true };
  })(ctx, next);
});

/*
router.get('/auth/facebook', async function (ctx, next) {
    console.log("/auth/facebook called");
    yield passport.authenticate('facebook', function*(err, authId, info) {
        console.log("facebook called back");
        if (err) throw err
        if (info) console.log("info : "+info);
        yield authent(ctx, 'facebook', authId);
        ctx.redirect('/#/refresh');
    }).call(this);
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





