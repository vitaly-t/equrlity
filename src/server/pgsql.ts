"use strict";

import { isDev, shuffle } from "../lib/utils.js";
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';

let connectUrl: string = isDev() ? process.env.DEV_AMPLITUDE_URL : process.env.AMPLITUDE_URL;

import * as OxiDate from '../lib/oxidate';

import { IMain, IDatabase } from 'pg-promise';
import * as pgPromise from 'pg-promise';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';
import * as uuid from '../lib/uuid.js';

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
  error: (err, e) => {
    // just for debugging ...
    // e.dc = Database Context

    if (e.cn) {
      // this is a connection-related error
      // cn = safe connection details passed into the library:
      //      if password is present, it is masked by #
    }

    if (e.query) {
      // query string is available
      if (e.params) {
        // query parameters are available
      }
    }

    if (e.ctx) {
      // occurred inside a task or transaction
    }
    console.log("pgPromise Error: " + err.toString());
  }

});

const oxb: OxiGen.IDbSchema = OxiGen.dbSchema;

//pgp.pg.types.setTypeParser(1114, str => moment.utc(str).format());

if (!connectUrl.startsWith('postgres:')) connectUrl = 'postgres:' + connectUrl;

export const db: IDatabase<any> = pgp(connectUrl);

export async function createDataTables() {
  let tbls = Array.from(oxb.tables.values())
  for (const t of tbls) {
    let stmt = OxiGen.genCreateTableStatement(t);
    console.log("creating table: " + t.name);
    await db.none(stmt);
  };
  DbCache.init();
}

export async function recreateDataTables() {
  console.log("recreating data tables");
  let tbls = Array.from(oxb.tables.values())
  let drops = tbls.map(t => t.name);
  drops.reverse();
  for (const t of drops) {
    let stmt = "DROP TABLE " + t;
    console.log(stmt);
    try { await db.none(stmt); }
    catch (e) {
      console.log(e.message);
    }
  }
  console.log("should all be dropped now");
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
    else {
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
      });
    }

    let userRows: Array<Dbt.User> = await db.any("select * from users;");
    users.clear();
    userRows.forEach(r => users.set(r.userId, r));

    let authRows: Array<Dbt.Auth> = await db.any("select * from auths");
    auths.clear();
    authRows.forEach(r => auths.set(r.authProvider + ":" + r.authId, r));

    let contentRows: Array<Dbt.Content> = await db.any("select * from contents");
    contents.clear();
    contentRows.forEach(r => contents.set(r.contentId, r));

    let linkRows: Dbt.Link[] = await db.any('select * from links order by "linkId" ');
    links.clear();
    linkRows.forEach(r => {
      links.set(r.linkId, r);
    });

    linkRows.forEach(r => {
      if (r.prevLink) {
        let prev = links.get(r.prevLink);
        connectUsers(r.userId, prev.userId);
      }
    });

    // maybe later ...
    //let userlinks: Array<Dbt.UserLink> = await db.any("select * from userlinks");
  }

  // all functions in cache (other than init) should be synchronous.  
  // async funcs that simply use the cache should go in the outer namespace

  export function connectUsers(userA: Dbt.userId, userB: Dbt.userId): void {
    if (!userlinks.has(userA)) userlinks.set(userA, [userB])
    else {
      let a = userlinks.get(userA);
      if (a.indexOf(userB) < 0) a.push(userB);
    }
    if (!userlinks.has(userB)) userlinks.set(userB, [userA])
    else {
      let a = userlinks.get(userB);
      if (a.indexOf(userA) < 0) a.push(userA);
    }
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

  export function linkToUrl(linkId: Dbt.linkId): Dbt.urlString {
    let desc = DbCache.links.get(linkId).linkDescription;
    let content = getContentFromLinkId(linkId);
    if (desc) desc = desc.replace(/ /g, '_');
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

  export function checkMonikerUsed(newName) {
    return Object.keys(users).some(function (id) {
      return users[id].userName === newName;
    });

  };

}

export async function updateRecord(tblnm: string, rec: Object): Promise<void> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genUpdateStatement(tbl, rec);
  await db.none(stmt, rec);
}

export async function insertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genInsertStatement(tbl, rec);
  let rslt = await db.one(stmt, rec);
  return rslt;
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

export async function is_promoted(userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  let rslt = await db.any(`select created from promotions where "userId" = '${userId}' and "linkId" = ${linkId}`);
  return rslt.length === 1;
}

export async function deliver_new_promotions(userId: Dbt.userId): Promise<Dbt.urlString[]> {
  let links = await db.any(`select "linkId" from promotions where "userId" = '${userId}' and delivered is null `);
  await db.none(`update promotions set delivered = CURRENT_TIMESTAMP where "userId" = '${userId}' `);
  return links.map(l => DbCache.linkToUrl(l.linkId));
}

export async function promotions_count(linkId: Dbt.linkId): Promise<number> {
  let rslt = await db.one(`select count(*) as cnt from promotions where "linkId" = ${linkId}`);
  return parseInt(rslt.cnt);
}

export async function deliveries_count(linkId: Dbt.linkId): Promise<number> {
  let rslt = await db.one(`select count(*) as cnt from promotions where "linkId" = ${linkId} and delivered is not null`);
  return parseInt(rslt.cnt);
}

export async function promoteLink(link: Dbt.Link, amount: Dbt.integer) {
  let grph = DbCache.userlinks;
  if (!grph.has(link.userId)) return;
  let inc = DbCache.getLinkDepth(link) + 1;
  if (amount < inc) return;
  let s = new Set<Dbt.userId>();
  s.add(link.userId);
  let q = shuffle(grph.get(link.userId));
  let linkId = link.linkId
  while (q.length > 0) {
    let userId = q.shift();
    let done = await is_promoted(userId, link.linkId);
    if (!done) {
      await insertRecord("promotions", { linkId, userId });
      amount -= inc;
    }
    if (amount < inc) break;
    s.add(userId);
    if (grph.has(userId)) {
      shuffle(grph.get(userId)).forEach(u => {
        if (!s.has(u)) q.push(u);
      })
    }
  }
}

export async function insert_content(userId: Dbt.userId, content: string, linkDescription: string, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let usr = DbCache.users.get(userId);
  if (amount > usr.ampCredits) throw new Error("Negative balances not allowed");

  let cont = await insertRecord<Dbt.Content>("contents", { ...emptyContent(), userId, content, contentType, amount });
  let contentId = cont.contentId;
  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...emptyLink(), userId, contentId, linkDescription, amount };
  let rslt = await insertRecord<Dbt.Link>("links", link);
  DbCache.contents.set(cont.contentId, cont);
  DbCache.links.set(rslt.linkId, rslt);
  await adjust_user_balance(DbCache.users.get(userId), -amount);
  await promoteLink(rslt, amount);
  return rslt;
}

export async function amplify_content(userId: Dbt.userId, content: string, linkDescription, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let usr = DbCache.users.get(userId);
  if (amount > usr.ampCredits) throw new Error("Negative balances not allowed");

  let prevLink = DbCache.getLinkIdFromUrl(parse(content));
  let prv = DbCache.links.get(prevLink);
  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...prv, userId, prevLink, linkDescription, amount };
  let rslt = await insertRecord<Dbt.Link>("links", link);
  DbCache.links.set(rslt.linkId, rslt);
  await adjust_user_balance(DbCache.users.get(userId), -amount);
  await promoteLink(rslt, amount);
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
  let links = await db.any(`select * from links where "userId" = '${userId}'`);
  return links;
}

export async function redeem_link(link: Dbt.Link): Promise<void> {
  let linkIdsToReParent = await db.any(`select "linkId" from links where "prevLink" = ${link.linkId}`)
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
  return rslt.length === 1;
}

export async function view_count(linkId: Dbt.linkId): Promise<number> {
  let rslt = await db.one(`select count(*) as cnt from views where "linkId" = ${linkId}`);
  return parseInt(rslt.cnt);
}

export async function getLinkAlreadyInvestedIn(userId: Dbt.userId, contentId: Dbt.contentId): Promise<Dbt.linkId | null> {
  let recs = await db.any(`select "linkId" from links where "contentId" = ${contentId} and "userId" = '${userId}' `);
  if (recs.length > 0) return recs[0].linkId;
  return null;
}

export async function payForView(viewerId: Dbt.userId, viewedLinkId: Dbt.linkId): Promise<void> {
  //@@GS  thought long and hard about using a transaction here, but couldn't see
  // a way of doing it safely without locking the whole cache or similar.
  // given the small amounts involved I figured this would probably be ok.
  let links = DbCache.getChainFromLinkId(viewedLinkId);
  console.log("chain length: " + links.length);
  let viewedLink = links[0];
  let bal = viewedLink.amount;
  if (bal == 0) return;

  // is viewer already in links?
  if (links.findIndex(l => l.userId === viewerId) >= 0) return;

  await insertRecord("views", { userId: viewerId, linkId: viewedLinkId });
  DbCache.connectUsers(viewerId, viewedLink.userId);

  // viewer gets paid 1
  let viewer = DbCache.users.get(viewerId);
  let ampCredits = viewer.ampCredits + 1;
  viewer = { ...viewer, ampCredits }
  await updateRecord("users", viewer);
  DbCache.users.set(viewerId, viewer);
  bal -= 1

  // each link in the parent chain gets paid 1
  let stmt = OxiGen.genUpdateStatement(oxb.tables.get("links"), { linkId: 0, amount: 0 });
  let l = 1;
  while (bal > 0 && l < links.length) {
    let {linkId, amount} = links[l];
    amount += 1;
    try {
      await db.none(stmt, { linkId, amount });
      let link = DbCache.links.get(linkId);
      DbCache.links.set(linkId, { ...link, amount });
      bal -= 1;
    }
    catch (e) {
      console.log("error updating link: " + e.message);
    }
    l += 1;
  }
  if (bal == 0) {
    let link = DbCache.links.get(viewedLinkId);
    await redeem_link({ ...link, amount: 0 });
    DbCache.links.delete(viewedLinkId);
  }
  else {
    await db.none(stmt, { linkId: viewedLinkId, amount: bal });
    DbCache.links.set(viewedLinkId, { ...viewedLink, amount: bal });
  }
}

export async function createUser(): Promise<Dbt.User> {
  let o = DbCache.users;
  let i = o.size;
  let userName = ''
  while (true) {
    userName = "anonymous_" + i;
    if (!DbCache.checkMonikerUsed(userName)) break;
    ++i;
  }
  let userId = uuid.generate();
  let usr = { ...emptyUser(), userId, userName };
  let user = await upsert_user(usr);
  console.log("created user : " + JSON.stringify(user));
  return user;
};

export async function handleAddContent(userId, {publicKey, content, signature, linkDescription, amount}): Promise<Rpc.SendAddContentResponse> {
  let link = await getLinkFromContent(content);
  if (link) {
    let linkAmplifier = DbCache.users.get(userId).userName;
    let linkDepth = DbCache.getLinkDepth(link);
    let rsp: Rpc.AddContentAlreadyRegistered = { prevLink: DbCache.linkToUrl(link.linkId), linkAmplifier };
    return rsp;
  }
  link = await insert_content(userId, content, linkDescription, amount);
  let rsp: Rpc.AddContentOk = { link: DbCache.linkToUrl(link.linkId), linkDepth: 0 };
  return rsp;
}

export async function handleAmplify(userId, {publicKey, content, signature, linkDescription, amount}): Promise<Rpc.AddContentOk> {
  let linkId = DbCache.getLinkIdFromUrl(parse(content));
  let link = DbCache.links.get(linkId);
  let rslt = undefined;
  if (link.userId === userId) {
    rslt = await invest_in_link(link, amount);
  }
  else {
    let contentId = DbCache.getContentIdFromContent(content);
    let prevId = await getLinkAlreadyInvestedIn(userId, contentId);
    if (prevId) throw new Error("user has previously invested in this content");
    rslt = await amplify_content(userId, content, linkDescription, amount);
    // this call is really just to aid testing
    // through the UI it should not be possible to amplify a link without first viewing it
    DbCache.connectUsers(userId, link.userId);
  }

  let linkAmplifier = DbCache.users.get(userId).userName;
  let linkDepth = DbCache.getLinkDepth(rslt);
  return { link: DbCache.linkToUrl(rslt.linkId), linkDepth, linkAmplifier };

}


