"use strict";

import { Url, parse, format } from 'url';
import * as Rpc from '../lib/rpc';
import { CachedTable, CacheUpdate } from './cache';
import * as Utils from '../lib/utils';

import * as OxiDate from '../lib/oxidate';

import { ITask } from 'pg-promise';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';
import * as uuid from '../lib/uuid.js';


const oxb: OxiGen.IDbSchema = OxiGen.dbSchema;

export function updateRecord<T>(t: ITask<any>, tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genUpdateStatement(tbl, rec);
  return t.one(stmt, rec)
}

export function insertRecord<T>(t: ITask<any>, tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genInsertStatement(tbl, rec);
  return t.one(stmt, rec);
}

export function upsertRecord<T>(t: ITask<any>, tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genUpsertStatement(tbl, rec);
  return t.one(stmt, rec);
}

export async function retrieveRecord<T>(t: ITask<any>, tblnm: string, pk: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genRetrieveStatement(tbl, pk);
  let rslt = await t.any(stmt, pk);
  if (rslt.length > 0) return rslt[0];
  return null;
}

export async function deleteRecord<T>(t: ITask<any>, tblnm: string, pk: Object): Promise<boolean> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genDeleteStatement(tbl, pk);
  await t.none(stmt, pk);
  return true;
}

export async function getAllRecords<T>(t: ITask<any>, tblnm: string): Promise<T[]> {
  let rslt: T[] = await t.any("select * from " + tblnm);
  return rslt;
}

export async function checkMonikerUsed(t: ITask<any>, name: string): Promise<boolean> {
  let rslt = await t.any(`select "userId" from users where "userName" = '${name}' `);
  return rslt.length > 0;
};

export async function getAllAnonymousMonikers(t: ITask<any>): Promise<Dbt.userName[]> {
  let rslt = await t.any(`select distinct "userName" from users where "userName" like 'anonymous_%' `);
  return rslt.map(u => u.userName);
};

const upsert_user_sql = OxiGen.genUpsertStatement(oxb.tables.get("users"));
export async function upsertUser(t: ITask<any>, usr: Dbt.User): Promise<CacheUpdate[]> {
  let rslt: Dbt.User[] = await t.any(upsert_user_sql, usr);
  return rslt.map(record => { return { table: "users" as CachedTable, record }; });
}

export async function findUserByName(t: ITask<any>, name: string): Promise<Dbt.User | null> {
  let rslt = await t.any(`select * from users where "userName" = '${name}' `);
  return rslt.length > 0 ? rslt[0] : null;
};

export function emptyUser(): Dbt.User {
  let rec = OxiGen.emptyRec<Dbt.User>(oxb.tables.get("users"));
  return { ...rec, credits: 1000 };
}

export async function adjustUserBalance(t: ITask<any>, usr: Dbt.User, adj: Dbt.integer): Promise<CacheUpdate[]> {
  let credits = usr.credits + adj;
  if (credits < 0) throw new Error("Negative balances not allowed");
  let newusr = { ...usr, credits }
  let rslt = await upsertUser(t, newusr);
  return rslt;
}

export function emptyAuth(): Dbt.Auth {
  return OxiGen.emptyRec<Dbt.Auth>(oxb.tables.get("auths"));
}

export async function createAuth(t: ITask<any>, authId: Dbt.authId, userId: Dbt.userId, provider: Dbt.authProvider): Promise<CacheUpdate[]> {
  let obj = { ...emptyAuth(), authId: authId, userId: userId, created: new Date(), authProvider: provider };
  let rslt = await t.any(OxiGen.genInsertStatement(oxb.tables.get("auths")), obj);
  return rslt.map(record => { return { table: "auths" as CachedTable, record }; });
}

export async function getUserIdByAuthId(t: ITask<any>, provider: Dbt.authProvider, authId: Dbt.authId): Promise<Dbt.userId | null> {
  let rslt = await t.oneOrNone(`select "userId" from auths where "authId" = '${authId}' `);
  if (rslt) return rslt.userId;
  return null;
}

export async function getUserByAuthId(t: ITask<any>, authId: string, provider: Dbt.authProvider): Promise<Dbt.User | null> {
  let userId = await getUserIdByAuthId(t, provider, authId);
  if (userId) return await retrieveRecord<Dbt.User>(t, "users", { userId });
  return null;
}

export async function touchUser(t: ITask<any>, userId: Dbt.userId): Promise<Dbt.User> {
  let usr = await retrieveRecord<Dbt.User>(t, "users", { userId });
  return await updateRecord<Dbt.User>(t, "users", usr);
}

export async function touchAuth(t: ITask<any>, authProvider: Dbt.authProvider, authId: Dbt.authId): Promise<Dbt.Auth> {
  let auth = await retrieveRecord<Dbt.Auth>(t, "auths", { authProvider, authId });
  return await updateRecord<Dbt.Auth>(t, "auths", auth);
}

export function emptyContent(): Dbt.Content {
  return OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("contents"));
}

export function emptyLink(): Dbt.Link {
  return OxiGen.emptyRec<Dbt.Link>(oxb.tables.get("links"));
}

export async function getRootLinkIdsForContentId(t: ITask<any>, id: Dbt.contentId): Promise<Dbt.Link[]> {
  return await t.any(`select * from links where "contentId" = ${id} and "prevLink" is null`);
}

export async function getLinkFromContentId(t: ITask<any>, id: Dbt.contentId): Promise<Dbt.Link | null> {
  let recs = await getRootLinkIdsForContentId(t, id);
  let l = recs.length;
  if (l == 0) return null;
  if (l == 1) return recs[0];
  let i = Math.floor(Math.random() * l)
  return recs[i];
}

export async function getLinkFromContent(t: ITask<any>, url: Dbt.content): Promise<Dbt.Link | null> {
  let rslt = await t.oneOrNone(`select "contentId" from contents where content = '${url}'`);
  if (!rslt) return null;
  return await getLinkFromContentId(t, rslt.contentId);
}

export async function isPromoted(t: ITask<any>, userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  let rslt = await t.any(`select created from promotions where "userId" = '${userId}' and "linkId" = ${linkId}`);
  return rslt.length === 1;
}

export async function getContentFromLinkId(t: ITask<any>, linkId: Dbt.linkId): Promise<Dbt.Content> {
  let link: Dbt.Link = await retrieveRecord<Dbt.Link>(t, "links", { linkId });
  let contentId = link.contentId;
  return await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
}

export async function linkToUrl(t: ITask<any>, linkId: Dbt.linkId): Promise<Dbt.urlString> {
  let link = await retrieveRecord<Dbt.Link>(t, "links", { linkId });
  let desc = link.linkDescription;
  if (desc) desc = desc.replace(/ /g, '_');
  let url = parse(Utils.serverUrl);
  url.path = "/link/" + linkId.toString() + (desc ? "#" + desc : '')
  return format(url);
}

export async function deliverNewPromotions(t: ITask<any>, userId: Dbt.userId): Promise<Dbt.urlString[]> {
  let links = await t.any(`select "linkId" from promotions where "userId" = '${userId}' and delivered is null `);
  await t.none(`update promotions set delivered = CURRENT_TIMESTAMP where "userId" = '${userId}' `);
  let rslt: Dbt.urlString[] = [];
  for (const l of links) rslt.push(await linkToUrl(t, l.linkId));
  return rslt;
}

export async function promotionsCount(t: ITask<any>, linkId: Dbt.linkId): Promise<number> {
  let rslt = await t.one(`select count(*) as cnt from promotions where "linkId" = ${linkId}`);
  return parseInt(rslt.cnt);
}

export async function deliveriesCount(t: ITask<any>, linkId: Dbt.linkId): Promise<number> {
  let rslt = await t.one(`select count(*) as cnt from promotions where "linkId" = ${linkId} and delivered is not null`);
  return parseInt(rslt.cnt);
}

export async function insertContent(t: ITask<any>, userId: Dbt.userId, content: string, linkDescription: string, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<CacheUpdate[]> {
  let usr = await retrieveRecord<Dbt.User>(t, "users", { userId });
  if (amount > usr.credits) throw new Error("Negative balances not allowed");
  let rslt: CacheUpdate[] = [];
  let cont = await insertRecord<Dbt.Content>(t, "contents", { ...emptyContent(), userId, content, contentType, amount });
  rslt.push({ table: "contents" as CachedTable, record: cont });
  let contentId = cont.contentId;
  let link: Dbt.Link = { ...emptyLink(), userId, contentId, linkDescription, amount };
  link = await insertRecord<Dbt.Link>(t, "links", link);
  console.log("inserted link: " + link.linkId);
  rslt.push({ table: "links" as CachedTable, record: link });
  Array.prototype.push.apply(rslt, await adjustUserBalance(t, usr, -amount));
  return rslt;
}

export async function promoteContent(t: ITask<any>, userId: Dbt.userId, content: string, linkDescription, amount: Dbt.integer, contentType: Dbt.contentType = "url"): Promise<CacheUpdate[]> {
  let usr = await retrieveRecord<Dbt.User>(t, "users", { userId });
  if (amount > usr.credits) throw new Error("Negative balances not allowed");

  let prevLink = Utils.getLinkIdFromUrl(parse(content));
  let prv = await retrieveRecord<Dbt.Link>(t, "links", { linkId: prevLink });
  let link: Dbt.Link = { ...prv, userId, prevLink, linkDescription, amount };
  let rslt: CacheUpdate[] = [];
  link = await insertRecord<Dbt.Link>(t, "links", link);
  console.log("inserted link: " + link.linkId);
  rslt.push({ table: "links" as CachedTable, record: link });
  Array.prototype.push.apply(rslt, await adjustUserBalance(t, usr, -amount));
  return rslt;
}

export async function redeemLink(t: ITask<any>, link: Dbt.Link): Promise<CacheUpdate[]> {
  let linksToReParent = await t.any(`select * from links where "prevLink" = ${link.linkId}`)
  let stmt = `update links set "prevLink" = ${link.prevLink ? link.prevLink.toString() : 'null'} 
              where "prevLink" = ${link.linkId}`;
  await t.none(stmt);
  await t.none(`delete from links where "linkId" = ${link.linkId}`);
  let rslt: CacheUpdate[] = [];
  rslt.push({ table: "links" as CachedTable, record: link, remove: true });
  let user = await retrieveRecord<Dbt.User>(t, "users", { userId: link.userId });
  if (link.amount > 0) Array.prototype.push.apply(rslt, await adjustUserBalance(t, user, link.amount));
  for (const l of linksToReParent) {
    rslt.push({ table: "links" as CachedTable, record: { ...l, prevLink: link.prevLink } });
  };
  return rslt;
}

export async function investInLink(t: ITask<any>, link: Dbt.Link, adj: Dbt.integer): Promise<CacheUpdate[]> {
  let amount = link.amount + adj;
  if (amount < 0) throw new Error("Negative investments not allowed");
  if (amount == 0) {
    return await redeemLink(t, link);
  }
  let rslt: CacheUpdate[] = [];
  let user = await retrieveRecord<Dbt.User>(t, "users", { userId: link.userId });
  Array.prototype.push.apply(rslt, await adjustUserBalance(t, user, -adj));
  let newlink = { ...link, amount };
  newlink = await updateRecord<Dbt.Link>(t, "links", newlink);
  rslt.push({ table: "links" as CachedTable, record: newlink });
  return rslt;
}

export async function getLinksForUser(t: ITask<any>, userId: Dbt.userId): Promise<Dbt.Link[]> {
  let links = await t.any(`select * from links where "userId" = '${userId}'`);
  return links;
}

export async function hasViewed(t: ITask<any>, userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  let rslt = await t.any(`select created from views where "userId" = '${userId}' and "linkId" = ${linkId}`);
  return rslt.length === 1;
}

export async function viewCount(t: ITask<any>, linkId: Dbt.linkId): Promise<number> {
  let rslt = await t.one(`select count(*) as cnt from views where "linkId" = ${linkId}`);
  return parseInt(rslt.cnt);
}

export async function getLinkAlreadyInvestedIn(t: ITask<any>, userId: Dbt.userId, contentId: Dbt.contentId): Promise<Dbt.linkId | null> {
  let recs = await t.any(`select "linkId" from links where "contentId" = ${contentId} and "userId" = '${userId}' `);
  if (recs.length > 0) return recs[0].linkId;
  return null;
}

export async function payForView(t: ITask<any>, links: Dbt.Link[], viewerId: Dbt.userId, viewedLinkId: Dbt.linkId): Promise<CacheUpdate[]> {
  let rslt: CacheUpdate[] = [];
  let viewedLink = links[0];
  let bal = viewedLink.amount;
  if (bal == 0) return rslt;

  // is viewer already in links?
  if (links.findIndex(l => l.userId === viewerId) >= 0) return rslt;

  await insertRecord(t, "views", { userId: viewerId, linkId: viewedLinkId });

  // viewer gets paid 1
  let viewer = await retrieveRecord<Dbt.User>(t, "users", { userId: viewerId });
  let credits = viewer.credits + 1;
  viewer = { ...viewer, credits }
  viewer = await updateRecord<Dbt.User>(t, "users", viewer);
  rslt.push({ table: "users" as CachedTable, record: viewer });
  bal -= 1

  // each link in the parent chain gets paid 1
  let i = 1;
  while (bal > 0 && i < links.length) {
    let link = links[i];
    let amount = link.amount + 1;
    let r = await updateRecord<Dbt.Link>(t, "links", { ...link, amount });
    rslt.push({ table: "links" as CachedTable, record: r });
    bal -= 1;
    i += 1;
  }
  if (bal == 0) {
    let link = await retrieveRecord<Dbt.Link>(t, "links", { linkId: viewedLinkId });
    Array.prototype.push.apply(rslt, await redeemLink(t, { ...link, amount: 0 }));
    rslt.push({ table: "links" as CachedTable, record: viewedLink, remove: true });
  }
  else {
    let r = await updateRecord<Dbt.Link>(t, "links", { ...viewedLink, amount: bal });
    rslt.push({ table: "links" as CachedTable, record: r });
  }
  return rslt;
}

export async function createUser(t: ITask<any>, email?: string): Promise<Dbt.User> {
  let userName = '';
  if (email) {
    userName = email.split("@")[0];
  } else {
    let used = await getAllAnonymousMonikers(t);
    let i = 0;
    while (true) {
      userName = "anonymous_" + i;
      if (used.indexOf(userName) < 0) break;
      ++i;
    }
  }
  let userId = uuid.generate();
  let usr = { ...emptyUser(), userId, userName };
  return await insertRecord<Dbt.User>(t, "users", usr);
};

export async function getUserPosts(t: ITask<any>, id: Dbt.userId): Promise<Rpc.PostInfoItem[]> {
  let a: Dbt.Post[] = await t.any(`select * from posts where "userId" = '${id}' order by updated desc`);
  let posts: Rpc.PostInfoItem[] = [];
  for (const p of a) {
    let { postId, created, updated, title, tags } = p;
    let cont = await retrieveRecord<Dbt.Content>(t, "contents", { contentId: p.contentId });
    let contentUrl = cont ? cont.content : null;
    let published = cont ? cont.created : null;
    let itm: Rpc.PostInfoItem = { postId, title, tags, published, contentUrl, created, updated };
    posts.push(itm);
  };
  return posts;
}

export async function getPostBody(t: ITask<any>, id: Dbt.postId): Promise<string> {
  let rslt = await t.one(`select body from posts where "postId" = '${id}' `);
  return rslt.body;
}

export async function savePost(t: ITask<any>, userId: Dbt.userId, req: Rpc.SavePostRequest): Promise<Dbt.Post> {
  let { postId, title, body, tags } = req;
  let p = { userId, postId, title, body, tags };
  let post: Dbt.Post;
  if (req.publish && req.investment > 0) p['published'] = new Date();
  return await upsertRecord<Dbt.Post>(t, "posts", p);
}

export async function registerInvitation(t: ITask<any>, ipAddress: string, linkId: Dbt.linkId): Promise<Dbt.Invitation> {
  return await upsertRecord<Dbt.Invitation>(t, "invitations", { ipAddress, linkId });
}
