"use strict";

import {isDev} from "../lib/utils.js";
import * as Url from 'url';                    

const curl = isDev() ? process.env.DEV_AMPLITUDE_URL
                    : process.env.AMPLITUDE_URL;

import * as OxiDate from '../lib/oxidate';

import { IMain, IDatabase } from 'pg-promise';
import * as pgPromise from 'pg-promise';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';

// your protocol extensions:
//interface IExtensions {
//    findUser(userId: number): Promise<any>;
//}

// pg-promise initialization options:
// var options = {
//     extend: obj => {
//         obj.findUser = userId => {
//             return obj.one('SELECT * FROM Users WHERE id=$1', userId);
//         }
//     }
// };


// initializing the library:
//var pgp: IMain = pgPromise(options);

// database object with extensions:
//var db = <IDatabase<IExtensions>&IExtensions>pgp(cn);

// now you can use the extensions everywhere (including tasks and transactions):
//db.findUser(123).then(...);

const pgp: IMain = pgPromise({
  // Initialization Options
});

const oxb: OxiGen.IDbSchema = OxiGen.dbSchema;

//pgp.pg.types.setTypeParser(1114, str => moment.utc(str).format());

// ahem ... cache the whole db in memory 
export const db: IDatabase<any> = pgp('postgres:'+curl);
export const users = new Map<Dbt.userId, Dbt.User>();
export const auths = new Map<Dbt.authId, Dbt.Auth>();
export const contents = new Map<Dbt.contentId, Dbt.Content>();
export const links = new Map<Dbt.linkId, Dbt.Link>();

export async function init() {
  let userRows: Array<Dbt.User> = await db.any("select * from users;");
  userRows.forEach(r => users.set(r.userId, r ));

  let authRows: Array<Dbt.Auth> = await db.any("select * from auths");
  authRows.forEach(r => auths.set(r.authId, r));

  let contentRows: Array<Dbt.Content> = await db.any("select * from contents");
  contentRows.forEach(r => contents.set(r.contentId, r));

  let linkRows: Array<Dbt.Link> = await db.any("select * from links");
  linkRows.forEach(r => links.set(r.linkId, r));
}

export function query(cqry) {
  return db.any;
}

export function emptyUser(): Dbt.User {
  return OxiGen.emptyRec<Dbt.User>(oxb.tables.get("users"));
}

const upsert_user_sql = OxiGen.genUpsertStatement(oxb.tables.get("users"));
export async function upsert_user(usr: Dbt.User) {
  //console.log('Inserting user : ' + userName ) ;
  let updated = new Date();
  let created = usr.created || updated
  let newusr = {...usr, created, updated };
  await db.none(upsert_user_sql, newusr)
  users.set(usr.userId, newusr);
  return newusr;
};

export function emptyAuth(): Dbt.Auth {
  return OxiGen.emptyRec<Dbt.Auth>(oxb.tables.get("auths"));
}

const upsert_auth_sql = OxiGen.genUpsertStatement(oxb.tables.get("auths"))
export async function upsert_auth(auth: Dbt.Auth) {
  let updated = new Date();
  let created = auth.created || updated
  let newauth = {...auth, created, updated };
  await db.none(upsert_auth_sql, newauth);
  auths.set(auth.authId, newauth);
};

export function get_user_from_auth(prov, authId) {
  let rslt = auths[prov + ':' + authId];
  if (rslt) rslt = users[rslt];
  return rslt;
};

export async function touch_user(userId) {
  let usr = users.get(userId);
  let dt = new Date();
  await db.none('update users set updated = $2 where "userId" = $1', [userId, dt])
  usr = {...usr, updated: dt};
  users.set(usr.userId, usr);
};

export async function touch_auth(prov, authId) {
  let key = prov + ':' + authId;
  let auth = auths.get(key);
  let dt = new Date();
  await db.none('update auths set updated = $2 where "authId" = $1', [key, dt]);
  auth = {...auth, updated: dt};
  auths.set(auth.authId, auth);
};


