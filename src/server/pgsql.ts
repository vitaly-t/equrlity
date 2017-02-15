"use strict";

import { isDev } from "../lib/utils.js";
import { Url, parse } from 'url';

let connectUrl: string = isDev() ? process.env.DEV_AMPLITUDE_URL : process.env.AMPLITUDE_URL;

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

if (!connectUrl.startsWith('postgres:')) connectUrl = 'postgres:' + connectUrl;

export const db: IDatabase<any> = pgp(connectUrl);

export namespace DbCache {
  // ahem ... cache the whole db in memory 
  export const users = new Map<Dbt.userId, Dbt.User>();
  export const auths = new Map<Dbt.authId, Dbt.Auth>();
  export const contents = new Map<Dbt.contentId, Dbt.Content>();
  export const links = new Map<Dbt.linkId, Dbt.Link>();
  export let linkRows: Array<Dbt.Link> = [];
  export const domain = isDev() ? 'localhost:8080' : process.env.AMPLITUDE_DOMAIN;
  export function isSynereo(url: Url): boolean {
    return url.host === domain;
  }

  export async function init() {
    let tbls: Array<any> = await db.any("select table_name from information_schema.tables where table_schema = 'public'");
    if (tbls.length == 0) {
      console.log("Creating data tables");
      await createDataTables();
      console.log(" ... finished creating data tables");
    }
    oxb.tables.forEach(async t => {
      if (tbls.findIndex(v => v.table_name === t.name) < 0) {
        let stmt = OxiGen.genCreateTableStatement(t);
        await db.none(stmt);
      }
      else {
        let cols: Array<any> = await db.any(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name   = '${t.name}'`);
        t.rowType.heading.forEach(async c => {
          if (cols.findIndex(v => v.column_name === c.name) < 0) {
            let stmt = `ALTER TABLE "${t.name}" ADD COLUMN "${c.name}" ${c.type.sqlType} `;
            await db.none(stmt);
          }
        })
      }
    })

    let userRows: Array<Dbt.User> = await db.any("select * from users;");
    users.clear();
    userRows.forEach(r => users.set(r.userId, r));

    let authRows: Array<Dbt.Auth> = await db.any("select * from auths");
    auths.clear();
    authRows.forEach(r => auths.set(r.authId, r));

    let contentRows: Array<Dbt.Content> = await db.any("select * from contents");
    contents.clear();
    contentRows.forEach(r => contents.set(r.contentId, r));

    linkRows = await db.any("select * from links order by \"linkId\" desc");
    links.clear();
    linkRows.forEach(r => links.set(r.linkId, r));

  }

  export function getChainFromLinkId(linkId: Dbt.linkId): Array<Dbt.Link> {
    let link = links.get(linkId);
    let rslt = [link]
    while (link.prevLink) {
      link = links.get(link.prevLink);
      rslt.push(link);
    }
    return rslt;
  }

  export function getChainFromContent(content: Dbt.content): Array<Dbt.Link> {
    let id = contentIdFromContent(content);
    if (!id) return [];
    let link = linkRows.find(l => l.contentId == id);
    if (!link) return [];
    return getChainFromLinkId(link.linkId);
  }
  export function getContentFromLinkId(linkId: Dbt.linkId): string | null {
    let link = links.get(linkId);
    if (!link) return null;
    let content = contents.get(link.contentId);
    if (!content) return null;
    return content.content;
  }

  export function getLinkFromContent(content: string): Dbt.Link | null {
    let id = contentIdFromContent(content);
    if (!id) return null;
    let link = linkRows.find(l => l.contentId == id);
    if (!link) return null;
    return link;
  }

  export function contentIdFromContent(content: string): Dbt.contentId | null {
    let result = null;
    for (const [k, v] of contents) {
      if (v.content === content) {
        result = k;
        break;
      }
    }
    return result;
  }

  export function isContentKnown(content: string): boolean {
    return contentIdFromContent != null;
  }

  export function linkToUri(linkId: Dbt.linkId): string {
    let content = getContentFromLinkId(linkId);
    return "http://" + domain + "/link/" + linkId.toString() + "#" + content
  }

  export function getLinkIdFromUrl(url: Url): Dbt.linkId {
    if (!isSynereo(url)) throw new Error("Not a synero url");
    if (!url.path.startsWith("/link/")) throw new Error("Malformed link path");
    let linkId = parseInt(url.path.substring(6));
    return linkId;
  }

}

export function query(cqry) {
  return db.any;
}

export function emptyUser(): Dbt.User {
  let rec = OxiGen.emptyRec<Dbt.User>(oxb.tables.get("users"));
  return { ...rec, ampCredits: 100 };
}

const upsert_user_sql = OxiGen.genUpsertStatement(oxb.tables.get("users"));
export async function upsert_user(usr: Dbt.User) {
  //console.log('Inserting user : ' + userName ) ;
  let updated = new Date();
  let created = usr.created || updated
  let newusr = { ...usr, created, updated };
  await db.none(upsert_user_sql, newusr)
  DbCache.users.set(usr.userId, newusr);
  return newusr;
};

export async function adjust_user_balance(usr: Dbt.User, adj: Dbt.integer) {
  let tbl = oxb.tables.get("users");
  let ampCredits = usr.ampCredits + adj;
  let newusr = { ...usr, ampCredits }
  let stmt = OxiGen.genUpdateStatement(tbl, newusr);
  await db.none(stmt, newusr);
  DbCache.users.set(usr.userId, newusr);
}

export function emptyAuth(): Dbt.Auth {
  return OxiGen.emptyRec<Dbt.Auth>(oxb.tables.get("auths"));
}

const upsert_auth_sql = OxiGen.genUpsertStatement(oxb.tables.get("auths"))
export async function upsert_auth(auth: Dbt.Auth) {
  let updated = new Date();
  let created = auth.created || updated
  let newauth = { ...auth, created, updated };
  await db.none(upsert_auth_sql, newauth);
  DbCache.auths.set(auth.authId, newauth);
};

export function get_user_from_auth(prov, authId) {
  let rslt = DbCache.auths[prov + ':' + authId];
  if (rslt) rslt = DbCache.users[rslt];
  return rslt;
};

export async function touch_user(userId) {
  let usr = DbCache.users.get(userId);
  let dt = new Date();
  await db.none('update users set updated = $2 where "userId" = $1', [userId, dt])
  usr = { ...usr, updated: dt };
  DbCache.users.set(usr.userId, usr);
};

export async function touch_auth(prov, authId) {
  let key = prov + ':' + authId;
  let auth = DbCache.auths.get(key);
  let dt = new Date();
  await db.none('update auths set updated = $2 where "authId" = $1', [key, dt]);
  auth = { ...auth, updated: dt };
  DbCache.auths.set(auth.authId, auth);
};

export function emptyContent(): Dbt.Content {
  return OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("contents"));
}

export function emptyLink(): Dbt.Link {
  return OxiGen.emptyRec<Dbt.Link>(oxb.tables.get("links"));
}

export async function insert_content(userId: Dbt.userId, content: string, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let cont: Dbt.Content = { ...emptyContent(), userId, content, contentType, amount };
  let contents = oxb.tables.get("contents");
  let stmt = OxiGen.genInsertStatement(contents, cont);
  let rslt1 = await db.one(stmt, cont);
  let {contentId} = rslt1;

  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...emptyLink(), userId, contentId, amount };
  let rslt2 = await db.one(OxiGen.genInsertStatement(links, link), link);
  let {linkId} = rslt2;
  let rslt = { ...link, linkId };
  DbCache.contents.set(contentId, { ...cont, contentId });
  DbCache.linkRows.push(rslt);
  DbCache.links.set(linkId, rslt);
  await adjust_user_balance(DbCache.users.get(userId), -amount);
  return rslt;
}

export async function amplify_content(userId: Dbt.userId, content: string, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let prevLink = DbCache.getLinkIdFromUrl(parse(content));
  let prv = DbCache.links.get(prevLink);
  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...prv, userId, prevLink, amount };
  let {linkId} = await db.one(OxiGen.genInsertStatement(links, link), link);
  let rslt = { ...link, linkId };
  DbCache.linkRows.push(rslt);
  DbCache.links.set(linkId, rslt);
  await adjust_user_balance(DbCache.users.get(userId), -amount);
  return rslt;
}

export async function createDataTables() {   //  careful with that axe, Eugene!
  let tbls = Array.from(oxb.tables.values())
  for (const t of tbls) {
    let stmt = OxiGen.genCreateTableStatement(t);
    await db.none(stmt);
  };
  DbCache.init();
}

export async function recreateDataTables() {   //  careful with that axe, Eugene!
  let tbls = Array.from(oxb.tables.values())
  let drops = tbls.map(t => "DROP TABLE " + t.name + ";\n");
  drops.reverse();
  let dropall = drops.join("\n");
  await db.none(dropall);
  await createDataTables();
  DbCache.init();
}

export async function resetDataTables() {   //  careful with that axe, Eugene!
  let tbls = Array.from(oxb.tables.values()).reverse()
  for (const t of tbls) {
    let stmt = "DELETE FROM " + t.name + ";\n";
    await db.none(stmt);
  };
  DbCache.init();
}


