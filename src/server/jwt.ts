import * as assert from 'assert';
import { verify } from 'jsonwebtoken';
import * as Koa from 'koa';

export { sign, verify, decode } from 'jsonwebtoken';

export function jwt(opts): (cxt: Koa.Context, next: () => Promise<any>) => any {

  return async function (ctx: Koa.Context, next: () => Promise<any>) {
    var token, user;
    let auth: string = ctx.header.authorization;
    if (auth) {
      if (auth.startsWith('Bearer ')) token = auth.substring(7);
      else {
        ctx[opts.key] = null
        ctx.throw(400, 'Bad Authorization header format. Format is "Authorization: Bearer <token>"');
        return;
      }

      try {
        user = verify(token, opts.secret, opts);
      } catch (e) {
        console.log('Invalid token : ' + e.message);
        ctx[opts.key] = null
        ctx.throw(400, 'Invalid token supplied');
        return;
      }

      ctx[opts.key] = user;
      ctx['token'] = token;
    }

    await next();
  };
};

