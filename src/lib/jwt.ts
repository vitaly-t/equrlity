import * as assert from 'assert';
import * as JWT from 'jsonwebtoken';
import * as Koa from 'koa';

// Export JWT methods as a convenience
export { sign, verify, decode } from 'jsonwebtoken';

export function jwt(opts): (cxt: Koa.Context, next?: () => Promise<any>) => any {
  opts = opts || {};
  opts.key = opts.key || 'user';

  assert(opts.secret, '"secret" option is required');

  return async function (ctx: Koa.Context, next?: () => Promise<any>) {
    var token, msg, user, parts, scheme, credentials, ignoreExp;

    if (opts.cookie) {
      token = ctx.cookies.get(opts.cookie);
      if (!token && !opts.passthrough) this.throw(401, "Missing cookie");
    } else if (ctx.header.authorization) {
      parts = ctx.header.authorization.split(' ');
      if (parts.length == 2) {
        scheme = parts[0];
        credentials = parts[1];

        if (/^Bearer$/i.test(scheme)) {
          token = credentials;
        }
      } else ctx.throw(401, 'Bad Authorization header format. Format is "Authorization: Bearer <token>"\n');

    } else ctx.throw(401, 'No Authorization header found\n');

    try {
      user = JWT.verify(token, opts.secret, opts);
    } catch (e) {
      msg = 'Invalid token : ' + e.message;
    }

    if (user || opts.passthrough) {
      ctx[opts.key] = user;
      await next();
    } else {
      ctx.throw(401, msg);
    }
  };
};

