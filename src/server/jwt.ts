import * as assert from 'assert';
import { verify } from 'jsonwebtoken';
import * as Koa from 'koa';

export { sign, verify, decode } from 'jsonwebtoken';

export function jwt(opts): (cxt: any, next: () => Promise<any>) => any {

  return async function (ctx: any, next: () => Promise<any>) {
    ctx[opts.key] = null;
    ctx['token'] = null;
    let auth: string = ctx.header.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        let token = auth.substring(7);
        let user = verify(token, opts.secret, opts);
        ctx[opts.key] = user;
        ctx['token'] = token;
      } catch (e) {
        //console.log('Invalid token : ' + e.message);
      }
    } //else console.log("No authorization header");
    await next();
  };
};

