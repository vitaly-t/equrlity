import * as assert from 'assert';
import { verify, sign } from 'jsonwebtoken';
import * as Koa from 'koa';
import * as Dbt from '../lib/datatypes';

const jwt_secret = process.env.JWT_PSEUDOQURL_KEY;
const opts = { ignoreExpiration: true, key: 'userId' };

type UserJwt = {
  publicKey: Dbt.publicKey;
  email: Dbt.email;
  id: Dbt.userId;
}

const _usrs = new Map<Dbt.userId, UserJwt>();

export function verifyJwt(token): UserJwt {
  let user: UserJwt = verify(token, jwt_secret, opts);
  _usrs.set(user.id, user);
  return user;
}

export function signJwt(user: UserJwt): string {
  return sign(user, jwt_secret);
}

export function getUserJwt(id: Dbt.userId): UserJwt {
  return _usrs.get(id);
}

export function jwt(): (ctx: any, next: () => Promise<any>) => any {

  return async function (ctx: any, next: () => Promise<any>) {
    ctx[opts.key] = null;
    ctx['token'] = null;
    let auth: string = ctx.header.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        let token = auth.substring(7);
        let user = verifyJwt(token);
        ctx[opts.key] = user;
        ctx['token'] = token;
      } catch (e) {
        //console.log('Invalid token : ' + e.message);
      }
    } //else console.log("No authorization header");
    await next();
  };
};


