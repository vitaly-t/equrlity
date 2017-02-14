import * as assert from 'assert';
import * as JWT from 'jsonwebtoken';
import * as Koa from 'koa';

export { sign, verify, decode } from 'jsonwebtoken';

export function jwt(opts): (cxt: Koa.Context, next: () => Promise<any>) => any {
  opts = opts || {};
  opts.key = opts.key || 'user';

  assert(opts.secret, '"secret" option is required');

  return async function (ctx: Koa.Context, next: () => Promise<any>) {
    var token, user;

    if (opts.cookie) token = ctx.cookies.get(opts.cookie);
    if (!token) {
      if (ctx.header.authorization) {
        let parts = ctx.header.authorization.split(' ');
        if (parts.length == 2) {
          let scheme = parts[0];
          let credentials = parts[1];

          if (/^Bearer$/i.test(scheme)) {
            token = credentials;
          }
        } else ctx.throw(401, 'Bad Authorization header format. Format is "Authorization: Bearer <token>"\n');

      }
    }
    try {
      user = JWT.verify(token, opts.secret, opts);
    } catch (e) {
      console.log('Invalid token : ' + e.message);
    }

    if (!user) {
      console.log("No user verified");
      ctx[opts.key] = null;
    }
    else {
      console.log("user verified")
      ctx[opts.key] = user;
      ctx['token'] = token;
    }
    await next();
  };
};

