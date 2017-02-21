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

export async function createDataTables() {
  let tbls = Array.from(oxb.tables.values())
  for (const t of tbls) {
    let stmt = OxiGen.genCreateTableStatement(t);
    await db.none(stmt);
  };
  DbCache.init();
}

export async function recreateDataTables() {
  let tbls = Array.from(oxb.tables.values())
  let drops = tbls.map(t => "DROP TABLE " + t.name + ";\n");
  drops.reverse();
  let dropall = drops.join("\n");
  await db.none(dropall);
  await createDataTables();
  DbCache.init();
}

export async function resetDataTables() {
  let tbls = Array.from(oxb.tables.values()).reverse()
  for (const t of tbls) {
    let stmt = "DELETE FROM " + t.name + ";\n";
    await db.none(stmt);
  };
  DbCache.init();
}

export namespace DbCache {

  // ahem ... cache (almost) the whole db in memory 
  export const users = new Map<Dbt.userId, Dbt.User>();
  export const auths = new Map<Dbt.authId, Dbt.Auth>();
  export const contents = new Map<Dbt.contentId, Dbt.Content>();
  export const links = new Map<Dbt.linkId, Dbt.Link>();
  export const userlinks = new Map<Dbt.userId, Dbt.userId[]>();
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
            console.log(`Adding column ${c.name} to table ${t.name}`);
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
    authRows.forEach(r => auths.set(r.authProvider + ":" + r.authId, r));

    let contentRows: Array<Dbt.Content> = await db.any("select * from contents");
    contents.clear();
    contentRows.forEach(r => contents.set(r.contentId, r));

    let linkRows = await db.any('select * from links order by "linkId" ');
    links.clear();
    linkRows.forEach(r => {
      links.set(r.linkId, r);
      //  if (!userlinks.has(r.userId))
    });

    // maybe later ...
    //let userlinks: Array<Dbt.UserLink> = await db.any("select * from userlinks");
  }

  // all functions in cache (other than init) should be synchronous.  
  // async funcs that simply use the cache should go in the outer namespace

  export function getChainFromLinkId(linkId: Dbt.linkId): Array<Dbt.Link> {
    let link = links.get(linkId);
    let rslt = [link]
    while (link.prevLink) {
      link = links.get(link.prevLink);
      rslt.push(link);
    }
    return rslt;
  }

  export function getLinkDepth(link: Dbt.Link): Dbt.integer {
    let rslt = 0
    while (link.prevLink) {
      ++rslt;
      link = links.get(link.prevLink);
    }
    return rslt;
  }

  export function getContentFromLinkId(linkId: Dbt.linkId): string | null {
    let link = links.get(linkId);
    if (!link) return null;
    let content = contents.get(link.contentId);
    if (!content) return null;
    return content.content;
  }

  export function getContentIdFromLinkId(linkId: Dbt.linkId): Dbt.contentId | null {
    let link = links.get(linkId);
    if (!link) return null;
    let content = contents.get(link.contentId);
    if (!content) return null;
    return content.contentId;
  }

  export function getContentIdFromContent(content: string): Dbt.contentId | null {
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
    return getContentIdFromContent(content) != null;
  }

  export function linkToUrl(linkId: Dbt.linkId): string {
    let desc = DbCache.links.get(linkId).linkDescription;
    let content = getContentFromLinkId(linkId);
    return (isDev() ? "http://" : "https://") + domain + "/link/" + linkId.toString() + (desc ? "#" + desc : '')
  }

  export function getLinkIdFromUrl(url: Url): Dbt.linkId {
    if (!isSynereo(url)) throw new Error("Not a synero url");
    if (!url.path.startsWith("/link/")) throw new Error("Malformed link path");
    let linkId = parseInt(url.path.substring(6));
    return linkId;
  }

  export function get_user_from_auth(prov, authId) {
    let rslt = auths[prov + ':' + authId];
    if (rslt) rslt = users[rslt];
    return rslt;
  }

}

export async function updateRecord(tblnm: string, rec: Object): Promise<void> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genUpdateStatement(tbl, rec);
  await db.none(stmt, rec);
}

export async function insertRecord(tblnm: string, rec: Object): Promise<any> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genInsertStatement(tbl, rec);
  return await db.oneOrNone(stmt, rec);
}

export function emptyUser(): Dbt.User {
  let rec = OxiGen.emptyRec<Dbt.User>(oxb.tables.get("users"));
  return { ...rec, ampCredits: 1000 };
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
}

export async function adjust_user_balance(usr: Dbt.User, adj: Dbt.integer) {
  let tbl = oxb.tables.get("users");
  let ampCredits = usr.ampCredits + adj;
  if (ampCredits < 0) throw new Error("Negative balances not allowed");
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

export async function touch_user(userId) {
  let usr = DbCache.users.get(userId);
  let dt = new Date();
  await db.none('update users set updated = $2 where "userId" = $1', [userId, dt])
  usr = { ...usr, updated: dt };
  DbCache.users.set(usr.userId, usr);
}

export async function touch_auth(prov, authId) {
  let auth = DbCache.auths.get(prov + ":" + authId);
  let dt = new Date();
  await db.none(`update auths set updated = $2 where "authId" = '${authId}' and "authProvider" = '${prov}' `);
  auth = { ...auth, updated: dt };
  DbCache.auths.set(auth.authProvider + ":" + auth.authId, auth);
}

export function emptyContent(): Dbt.Content {
  return OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("contents"));
}

export function emptyLink(): Dbt.Link {
  return OxiGen.emptyRec<Dbt.Link>(oxb.tables.get("links"));
}

export async function getLinkFromContent(url: Dbt.content): Promise<Dbt.Link | null> {
  let id = DbCache.getContentIdFromContent(url);
  if (!id) return null;
  return await getLinkFromContentId(id);
}

export async function getLinkFromContentId(id: Dbt.contentId): Promise<Dbt.Link | null> {

  let recs: Dbt.Link[] = await db.manyOrNone(`select * from links where "contentId" = ${id} and "prevLink" is null`);
  let l = recs.length;
  if (l == 0) return null;
  if (l == 1) return recs[0];
  let i = Math.floor(Math.random() * l)
  return recs[i];
}

export async function insert_content(userId: Dbt.userId, content: string, linkDescription: string, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let usr = DbCache.users.get(userId);
  if (amount > usr.ampCredits) throw new Error("Negative balances not allowed");

  let cont: Dbt.Content = { ...emptyContent(), userId, content, contentType, amount };
  let contents = oxb.tables.get("contents");
  let stmt = OxiGen.genInsertStatement(contents, cont);
  let rslt1 = await db.one(stmt, cont);
  let {contentId} = rslt1;

  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...emptyLink(), userId, contentId, linkDescription, amount };
  let rslt2 = await db.one(OxiGen.genInsertStatement(links, link), link);
  let {linkId} = rslt2;
  let rslt = { ...link, linkId };
  DbCache.contents.set(contentId, { ...cont, contentId });
  DbCache.links.set(linkId, rslt);
  await adjust_user_balance(DbCache.users.get(userId), -amount);
  return rslt;
}

export async function amplify_content(userId: Dbt.userId, content: string, linkDescription, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let usr = DbCache.users.get(userId);
  if (amount > usr.ampCredits) throw new Error("Negative balances not allowed");

  let prevLink = DbCache.getLinkIdFromUrl(parse(content));
  let prv = DbCache.links.get(prevLink);
  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...prv, userId, prevLink, linkDescription, amount };
  let {linkId} = await db.one(OxiGen.genInsertStatement(links, link), link);
  let rslt = { ...link, linkId };
  DbCache.links.set(linkId, rslt);
  await adjust_user_balance(DbCache.users.get(userId), -amount);
  return rslt;
}

export async function invest_in_link(link: Dbt.Link, adj: Dbt.integer): Promise<Dbt.Link | null> {
  let amount = link.amount + adj;
  if (amount < 0) throw new Error("Negative investments not allowed");
  if (amount == 0) {
    await redeem_link(link);
    return null;
  }
  await adjust_user_balance(DbCache.users.get(link.userId), -adj);
  let rslt = { ...link, amount };
  await updateRecord("links", rslt);
  DbCache.links.set(rslt.linkId, rslt);
  return rslt;
}

export async function get_links_for_user(userId: Dbt.userId): Promise<Dbt.Link[]> {
  let links = await db.manyOrNone(`select * from links where "userId" = '${userId}'`);
  return links;
}

export async function redeem_link(link: Dbt.Link): Promise<void> {
  let linkIdsToReParent = await db.manyOrNone(`select "linkId" from links where "prevLink" = ${link.linkId}`)
  let stmt = `update links set "prevLink" = ${link.prevLink ? link.prevLink.toString() : 'null'} 
              where "prevLink" = ${link.linkId}`;
  await db.none(stmt);
  await db.none(`delete from links where "linkId" = ${link.linkId}`);
  if (link.amount > 0) await adjust_user_balance(DbCache.users.get(link.userId), link.amount);
  linkIdsToReParent.forEach(({linkId}) => {
    let l = DbCache.links.get(linkId);
    DbCache.links.set(linkId, { ...l, prevLink: link.prevLink });
  });
}

export async function has_viewed(userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  let rslt = await db.any(`select created from views where "userId" = '${userId}' and "linkId" = ${linkId}`);
  return (rslt && rslt.length === 1);
}

export async function view_count(linkId: Dbt.linkId): Promise<number> {
  let rslt = await db.one(`select count(*) as cnt from views where "linkId" = ${linkId}`);
  return parseInt(rslt.cnt);
}

export async function getLinkAlreadyInvestedIn(userId: Dbt.userId, contentId: Dbt.contentId): Promise<Dbt.linkId | null> {
  let recs = await db.oneOrNone(`select "linkId" from links where "contentId" = ${contentId} and "userId" = ${userId}`);
  if (recs.length > 0) return recs[0].linkId;
  return null;
}

export async function payForView(viewerId: Dbt.userId, viewedLinkId: Dbt.linkId): Promise<Dbt.integer> {
  //@@GS  thought long and hard about using a transaction here, but couldn't see
  // a way of doing it safely without locking the whole cache or similar.
  // given the small amounts involved I figured this would probably be ok.
  let links = DbCache.getChainFromLinkId(viewedLinkId);
  let viewedLink = links[0];
  let bal = viewedLink.amount;
  if (bal == 0) return bal

  // is viewer already in links?
  if (links.findIndex(l => l.userId == viewerId) >= 0) return bal;

  // viewer gets paid 1
  let viewer = DbCache.users.get(viewerId);
  let ampCredits = viewer.ampCredits + 1;
  viewer = { ...viewer, ampCredits }
  await updateRecord("users", viewer);
  DbCache.users.set(viewerId, viewer);
  bal -= 1

  await insertRecord("views", { userId: viewerId, linkId: viewedLinkId });

  // each link in the parent chain gets paid 1
  let stmt = OxiGen.genUpdateStatement(oxb.tables.get("links"), { linkId: 0, amount: 0 });
  let l = links.length - 1
  while (bal > 0 && l > 0) {
    let {linkId, amount} = links[l];
    amount += 1;
    try {
      await db.none(stmt, { linkId, amount });
      let link = DbCache.links.get(linkId);
      DbCache.links.set(linkId, {...link, amount});
      bal -= 1;
    }
    catch (e) {
      console.log("error updating link: " + e.message);
    }
    l -= 1;
  }
  if (bal == 0) {
    let link = DbCache.links.get(viewedLinkId);
    await redeem_link({ ...link, amount: 0 });
    DbCache.links.delete(viewedLinkId);
  }
  else {
    await db.none(stmt, { linkId: viewedLinkId, amount: bal });
    DbCache.links.set(viewedLinkId, {...viewedLink, amount: bal});
  }
}

