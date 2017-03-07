"use strict";

import { isDev, isTest, shuffle, serverUrl } from "../lib/utils.js";
import { Url, parse, format } from 'url';
import * as Rpc from '../lib/rpc';
import * as cache from './cache';

let connectUrl: string = isTest() ? process.env.DEV_AMPLITUDE_TEST_URL : isDev() ? process.env.DEV_AMPLITUDE_URL : process.env.AMPLITUDE_URL;

import * as OxiDate from '../lib/oxidate';

import { IMain, IDatabase } from 'pg-promise';
import * as pgPromise from 'pg-promise';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';
import * as uuid from '../lib/uuid.js';
import { genInsertStatement } from "../lib/oxigen";

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

export async function init() {
  console.log("pg init called. connected to:" + connectUrl);
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
  await initCache();
}

export async function initCache() {
  let userRows: Array<Dbt.User> = await db.any("select * from users;");
  let authRows: Array<Dbt.Auth> = await db.any("select * from auths");
  let contentRows: Array<Dbt.Content> = await db.any("select * from contents");
  let linkRows: Dbt.Link[] = await db.any('select * from links order by "linkId" ');
  cache.init(userRows, authRows, contentRows, linkRows);
}

export async function createDataTables() {
  let tbls = Array.from(oxb.tables.values())
  for (const t of tbls) {
    let stmt = OxiGen.genCreateTableStatement(t);
    console.log("creating table: " + t.name);
    await db.none(stmt);
  };
  await initCache();
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
  await initCache();
}

export async function resetDataTables() {
  let tbls = Array.from(oxb.tables.values()).reverse()
  for (const t of tbls) {
    let stmt = "DELETE FROM " + t.name + ";\n";
    await db.none(stmt);
  };
  await initCache();
}

export async function updateRecord<T>(tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genUpdateStatement(tbl, rec);
  return await db.one(stmt, rec);
}

export async function insertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genInsertStatement(tbl, rec);
  return await db.one(stmt, rec);
}

export async function upsertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genUpsertStatement(tbl, rec);
  return await db.one(stmt, rec);
}

export async function retrieveRecord<T>(tblnm: string, pk: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genRetrieveStatement(tbl, pk);
  let rslt = await db.any(stmt, pk);
  if (rslt.length > 0) return rslt[0];
  return null;
}

export async function deleteRecord<T>(tblnm: string, pk: Object): Promise<boolean> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genDeleteStatement(tbl, pk);
  await db.none(stmt, pk);
  return true;
}

export async function getAllRecords<T>(tblnm: string): Promise<T[]> {
  let rslt: T[] = await db.any("select * from " + tblnm);
  return rslt;
}

export async function checkMonikerUsed(name: string): Promise<boolean> {
  let rslt = await db.any(`select "userId" from users where "userName" = '${name}' `);
  return rslt.length > 0;
};

export async function getAllAnonymousMonikers(): Promise<Dbt.userName[]> {
  let rslt = await db.any(`select distinct "userName" from users where "userName" like 'anonymous_%' `);
  return rslt.map(u => u.userName);
};

export async function changeMoniker(id: Dbt.userId, newName: string): Promise<boolean> {
  console.log("setting new Moniker : " + newName);
  if (await checkMonikerUsed(newName)) return false;
  let prv = cache.users[id];
  let usr = { ...prv, userName: newName };
  console.log("updating user : " + JSON.stringify(usr));
  let updt = await upsert_user(usr);
  console.log("user updated : " + JSON.stringify(updt));
  return true;
}

export async function findUserByName(name: string): Promise<Dbt.User | null> {
  let rslt = await db.any(`select * from users where "userName" = '${name}' `);
  return rslt.length > 0 ? rslt[0] : null;
};

export function emptyUser(): Dbt.User {
  let rec = OxiGen.emptyRec<Dbt.User>(oxb.tables.get("users"));
  return { ...rec, credits: 1000 };
}

const upsert_user_sql = OxiGen.genUpsertStatement(oxb.tables.get("users"));
export async function upsert_user(usr: Dbt.User): Promise<Dbt.User> {
  let rslt: Dbt.User[] = await db.any(upsert_user_sql, usr);
  let r = rslt[0];
  cache.users.set(r.userId, r);
  return r;
}

export async function adjust_user_balance(usr: Dbt.User, adj: Dbt.integer): Promise<Dbt.User> {
  let credits = usr.credits + adj;
  if (credits < 0) throw new Error("Negative balances not allowed");
  let newusr = { ...usr, credits }
  let r = updateRecord<Dbt.User>("users", newusr);
  cache.users.set(usr.userId, newusr);
  return r;
}

export function emptyAuth(): Dbt.Auth {
  return OxiGen.emptyRec<Dbt.Auth>(oxb.tables.get("auths"));
}

const upsert_auth_sql = OxiGen.genUpsertStatement(oxb.tables.get("auths"));
export async function upsert_auth(auth: Dbt.Auth): Promise<Dbt.Auth> {
  let r = await db.one(upsert_auth_sql, auth);
  cache.auths.set(r.authId, r);
  return r;
}

export async function createAuth(authId, userId, provider): Promise<Dbt.Auth> {
  let obj = { ...emptyAuth(), authId: authId, userId: userId, created: new Date(), authProvider: provider };
  let r = await db.one(genInsertStatement(oxb.tables.get("auths")), obj);
  cache.auths.set(r.authId, r);
  return r;
}

export async function getUserIdByAuthId(provider: Dbt.authProvider, authId: Dbt.authId): Promise<Dbt.userId | null> {
  let rslt = await db.oneOrNone(`select "userId" from auths where "authId" = '${authId}' `);
  if (rslt) return rslt.userId;
  return null;
}

export async function getUserByAuthId(authId: string, provider: Dbt.authProvider): Promise<Dbt.User | null> {
  let userId = await getUserIdByAuthId(provider, authId);
  if (userId) return cache.users.get(userId);
  return null;
}

export async function touch_user(userId) {
  let usr = cache.users.get(userId);
  let rslt = await updateRecord<Dbt.User>("users", usr);
  cache.users.set(userId, rslt);
}

export async function touch_auth(prov, authId) {
  let auth = cache.auths.get(prov + ":" + authId);
  let dt = new Date();
  await db.none(`update auths set updated = $2 where "authId" = '${authId}' and "authProvider" = '${prov}' `);
  auth = { ...auth, updated: dt };
  cache.auths.set(auth.authProvider + ":" + auth.authId, auth);
}

export function emptyContent(): Dbt.Content {
  return OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("contents"));
}

export function emptyLink(): Dbt.Link {
  return OxiGen.emptyRec<Dbt.Link>(oxb.tables.get("links"));
}

export async function getLinkFromContent(url: Dbt.content): Promise<Dbt.Link | null> {
  let id = cache.getContentIdFromContent(url);
  if (!id) return null;
  return await getLinkFromContentId(id);
}

export async function getRootLinkIdsForContentId(id: Dbt.contentId): Promise<Dbt.Link[]> {
  return await db.any(`select * from links where "contentId" = ${id} and "prevLink" is null`);
}

export async function getLinkFromContentId(id: Dbt.contentId): Promise<Dbt.Link | null> {
  let recs = await getRootLinkIdsForContentId(id);
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
  return links.map(l => cache.linkToUrl(l.linkId));
}

export async function promotions_count(linkId: Dbt.linkId): Promise<number> {
  let rslt = await db.one(`select count(*) as cnt from promotions where "linkId" = ${linkId}`);
  return parseInt(rslt.cnt);
}

export async function deliveries_count(linkId: Dbt.linkId): Promise<number> {
  let rslt = await db.one(`select count(*) as cnt from promotions where "linkId" = ${linkId} and delivered is not null`);
  return parseInt(rslt.cnt);
}

export async function getPromotionLinks(link: Dbt.Link, maxLen: Dbt.integer = cache.users.size): Promise<Dbt.userId[]> {
  let grph = cache.userlinks;
  if (!grph.has(link.userId)) return;
  let rem = maxLen;
  let rslt: Dbt.userId[] = [];
  let s = new Set<Dbt.userId>();
  s.add(link.userId);
  let q = shuffle<Dbt.userId>(grph.get(link.userId));
  let linkId = link.linkId
  while (q.length > 0) {
    let userId = q.shift();
    let done = await is_promoted(userId, link.linkId);
    if (!done) {
      rslt.push(userId);
      rem -= 1;
    }
    if (rem == 0) break;
    s.add(userId);
    if (grph.has(userId)) {
      shuffle<Dbt.userId>(grph.get(userId)).forEach(u => {
        if (!s.has(u)) q.push(u);
      })
    }
  }
  return rslt;
}

export async function promoteLink(link: Dbt.Link, amount: Dbt.integer): Promise<void> {
  let linkId = link.linkId;
  let grph = cache.userlinks;
  if (!grph.has(link.userId)) return;
  let inc = cache.getLinkDepth(link) + 1;
  if (amount < inc) return;
  let max = Math.floor(amount / inc);
  let ids = await getPromotionLinks(link, max);
  for (const userId of ids) await insertRecord("promotions", { linkId, userId });
}

export async function insert_content(userId: Dbt.userId, content: string, linkDescription: string, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let usr = cache.users.get(userId);
  if (amount > usr.credits) throw new Error("Negative balances not allowed");

  let cont = await insertRecord<Dbt.Content>("contents", { ...emptyContent(), userId, content, contentType, amount });
  let contentId = cont.contentId;
  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...emptyLink(), userId, contentId, linkDescription, amount };
  let rslt = await insertRecord<Dbt.Link>("links", link);
  cache.contents.set(cont.contentId, cont);
  cache.links.set(rslt.linkId, rslt);
  await adjust_user_balance(cache.users.get(userId), -amount);
  await promoteLink(rslt, amount);
  return rslt;
}

export async function amplify_content(userId: Dbt.userId, content: string, linkDescription, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<Dbt.Link> {
  let usr = cache.users.get(userId);
  if (amount > usr.credits) throw new Error("Negative balances not allowed");

  let prevLink = cache.getLinkIdFromUrl(parse(content));
  let prv = cache.links.get(prevLink);
  let links = oxb.tables.get("links");
  let link: Dbt.Link = { ...prv, userId, prevLink, linkDescription, amount };
  let rslt = await insertRecord<Dbt.Link>("links", link);
  cache.links.set(rslt.linkId, rslt);
  await adjust_user_balance(cache.users.get(userId), -amount);
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
  await adjust_user_balance(cache.users.get(link.userId), -adj);
  let rslt = { ...link, amount };
  let r = await updateRecord<Dbt.Link>("links", rslt);
  cache.links.set(r.linkId, r);
  return r;
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
  if (link.amount > 0) await adjust_user_balance(cache.users.get(link.userId), link.amount);
  linkIdsToReParent.forEach(({ linkId }) => {
    let l = cache.links.get(linkId);
    cache.links.set(linkId, { ...l, prevLink: link.prevLink });
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
  let links = cache.getChainFromLinkId(viewedLinkId);
  let viewedLink = links[0];
  let bal = viewedLink.amount;
  if (bal == 0) return;

  // is viewer already in links?
  if (links.findIndex(l => l.userId === viewerId) >= 0) return;

  await insertRecord("views", { userId: viewerId, linkId: viewedLinkId });
  cache.connectUsers(viewerId, viewedLink.userId);

  // viewer gets paid 1
  let viewer = cache.users.get(viewerId);
  let credits = viewer.credits + 1;
  viewer = { ...viewer, credits }
  let u = await updateRecord<Dbt.User>("users", viewer);
  cache.users.set(viewerId, u);
  bal -= 1

  // each link in the parent chain gets paid 1
  let i = 1;
  while (bal > 0 && i < links.length) {
    let link = links[i];
    let amount = link.amount + 1;
    try {
      let r = await updateRecord<Dbt.Link>("links", { ...link, amount });
      cache.links.set(r.linkId, r);
      bal -= 1;
    }
    catch (e) {
      console.log("error updating link: " + e.message);
    }
    i += 1;
  }
  if (bal == 0) {
    let link = cache.links.get(viewedLinkId);
    await redeem_link({ ...link, amount: 0 });
    cache.links.delete(viewedLinkId);
  }
  else {
    let r = await updateRecord<Dbt.Link>("links", { ...viewedLink, amount: bal });
    cache.links.set(r.linkId, r);
  }
}

export async function createUser(email?: string): Promise<Dbt.User> {
  let o = cache.users;
  let i = o.size;
  let userName = '';
  if (email) {
    userName = email.split("@")[0];
  } else {
    let used = await getAllAnonymousMonikers();
    while (true) {
      userName = "anonymous_" + i;
      if (used.indexOf(userName) < 0) break;
      ++i;
    }
  }
  let userId = uuid.generate();
  let usr = { ...emptyUser(), userId, userName };
  let user = await insertRecord<Dbt.User>("users", usr);
  console.log("user created : " + user.userName);
  if (cache.users.has(user.userId)) {
    throw new Error("cache is cactus");
  }
  cache.users.set(user.userId, user);
  return user;
};

export async function handleAddContent(userId, { publicKey, content, signature, linkDescription, amount }): Promise<Rpc.SendAddContentResponse> {
  let link = await getLinkFromContent(content);
  if (link) {
    let linkAmplifier = cache.users.get(userId).userName;
    let linkDepth = cache.getLinkDepth(link);
    let rsp: Rpc.AddContentAlreadyRegistered = { prevLink: cache.linkToUrl(link.linkId), linkAmplifier };
    return rsp;
  }
  link = await insert_content(userId, content, linkDescription, amount);
  let rsp: Rpc.AddContentOk = { link: cache.linkToUrl(link.linkId), linkDepth: 0 };
  return rsp;
}

export async function handleAmplify(userId, { publicKey, content, signature, linkDescription, amount }): Promise<Rpc.AddContentOk> {
  let linkId = cache.getLinkIdFromUrl(parse(content));
  let link = cache.links.get(linkId);
  let rslt = undefined;
  if (link.userId === userId) {
    rslt = await invest_in_link(link, amount);
  }
  else {
    let contentId = cache.getContentIdFromContent(content);
    let prevId = await getLinkAlreadyInvestedIn(userId, contentId);
    if (prevId) throw new Error("user has previously invested in this content");
    rslt = await amplify_content(userId, content, linkDescription, amount);
    // this call is really just to aid testing
    // through the UI it should not be possible to amplify a link without first viewing it
    cache.connectUsers(userId, link.userId);
  }

  let linkAmplifier = cache.users.get(userId).userName;
  let linkDepth = cache.getLinkDepth(rslt);
  return { link: cache.linkToUrl(rslt.linkId), linkDepth, linkAmplifier };

}

export async function GetUserLinks(id: Dbt.userId): Promise<Rpc.UserLinkItem[]> {
  let a = await get_links_for_user(id);
  let links = Promise.all(a.map(async l => {
    let linkId = l.linkId;
    let contentUrl = cache.contents.get(l.contentId).content;
    let linkDepth = cache.getLinkDepth(l);
    let viewCount = await view_count(linkId);
    let promotionsCount = await promotions_count(linkId);
    let deliveriesCount = await deliveries_count(linkId);
    let amount = l.amount;
    let rl: Rpc.UserLinkItem = { linkId, contentUrl, linkDepth, viewCount, promotionsCount, deliveriesCount, amount };
    return rl;
  }));
  return links;
}

export async function GetUserPosts(id: Dbt.userId): Promise<Rpc.PostInfoItem[]> {
  let a: Dbt.Post[] = await db.any(`select * from posts where "userId" = '${id}' order by updated desc`);
  let posts = Promise.all(a.map(async p => {
    let { postId, created, updated, title, tags } = p;
    let cont = cache.contents.get(p.contentId);
    let contentUrl = cont ? cont.content : null;
    let published = cont ? cont.created : null;
    let itm: Rpc.PostInfoItem = { postId, title, tags, published, contentUrl, created, updated };
    return itm;
  }));
  return posts;
}

export async function GetPostBody(id: Dbt.postId): Promise<string> {
  let rslt = await db.one(`select body from posts where "postId" = '${id}' `);
  return rslt.body;
}

export async function SavePost(userId: Dbt.userId, req: Rpc.SavePostRequest): Promise<Dbt.Post> {
  let { postId, title, body, tags } = req;
  let p = { userId, postId, title, body, tags };
  let post: Dbt.Post;
  if (req.publish && req.investment > 0) p['published'] = new Date();
  if (p.postId) post = await updateRecord<Dbt.Post>("posts", p);
  else post = await insertRecord<Dbt.Post>("posts", p);
  if (req.publish && req.investment > 0) {
    let url = parse(serverUrl);
    url.pathname = '/post/' + post.postId.toString();
    let content = format(url);
    await handleAddContent(userId, { publicKey: '', content, signature: '', linkDescription: title, amount: req.investment });
    let contentId = cache.getContentIdFromContent(content);
    post = await updateRecord<Dbt.Post>("posts", { ...post, contentId });
  }
  return post;
}

export async function registerInvitation(ipAddress: string, linkId: Dbt.linkId): Promise<Dbt.Invitation> {
  console.log("registering inv " + ipAddress);
  return await upsertRecord<Dbt.Invitation>("invitations", { ipAddress, linkId });
}
