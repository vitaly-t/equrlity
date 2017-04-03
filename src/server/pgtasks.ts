"use strict";

import { ITask } from 'pg-promise';
import { Url, parse, format } from 'url';

import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as OxiDate from '../lib/oxidate';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';
import * as uuid from '../lib/uuid.js';

import { CachedTable, CacheUpdate } from './cache';

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

export async function retrieveContentByTitle(t: ITask<any>, title: string, contentType: Dbt.contentType): Promise<Dbt.Content> {
  let ttl = title.replace(/_/g, " ");
  let rslt = await t.any(`select * from contents where title = '${ttl}' and "contentType" = '${contentType}' `);
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

export async function getRootLinksForUrl(t: ITask<any>, url: Dbt.urlString): Promise<Dbt.Link[]> {
  return await t.any(`select * from links where url = '${url}' and "prevLink" is null`);
}

export async function getRootLinksForContentId(t: ITask<any>, id: Dbt.contentId): Promise<Dbt.Link[]> {
  let url = Utils.contentToUrl(id);
  return await getRootLinksForUrl(t, url);
}

export async function findRootLinkForUrl(t: ITask<any>, url: Dbt.urlString): Promise<Dbt.Link> {
  let recs = await getRootLinksForUrl(t, url);
  let l = recs.length;
  if (l == 0) return null;
  if (l == 1) return recs[0];
  let i = Math.floor(Math.random() * l)
  return recs[i];
}

export async function findRootLinkForContentId(t: ITask<any>, id: Dbt.contentId): Promise<Dbt.Link> {
  let url = Utils.contentToUrl(id);
  return await findRootLinkForUrl(t, url);
}

export async function getLinksForContentId(t: ITask<any>, id: Dbt.contentId): Promise<Dbt.Link[]> {
  let url = Utils.contentToUrl(id);
  return await t.any(`select * from links where url = '${url}'`);
}

export async function getLinksForUrl(t: ITask<any>, url: Dbt.urlString): Promise<Dbt.Link[]> {
  return await t.any(`select * from links where url = '${url}'`);
}

export async function isPromoted(t: ITask<any>, userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  let rslt = await t.any(`select created from promotions where "userId" = '${userId}' and "linkId" = ${linkId}`);
  return rslt.length === 1;
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

export async function promoteLink(t: ITask<any>, userId: Dbt.userId, linkurl: string, linkDescription, amount: Dbt.integer): Promise<CacheUpdate[]> {
  let usr = await retrieveRecord<Dbt.User>(t, "users", { userId });
  if (amount > usr.credits) throw new Error("Negative balances not allowed");
  let ourl = parse(linkurl);
  let link: Dbt.Link = null;
  if (Utils.isPseudoQLinkURL(ourl)) {
    let prevLink = Utils.getLinkIdFromUrl(parse(linkurl));
    let prv = await retrieveRecord<Dbt.Link>(t, "links", { linkId: prevLink });
    link = { ...prv, userId, prevLink, linkDescription, amount };
  }
  else {
    link = { ...emptyLink(), userId, url: linkurl, linkDescription, amount };
  }
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

export async function getLinkAlreadyInvestedIn(t: ITask<any>, userId: Dbt.userId, url: Dbt.urlString): Promise<Dbt.linkId | null> {
  let recs = await t.any(`select "linkId" from links where url = '${url}' and "userId" = '${userId}' `);
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

export async function getUserContents(t: ITask<any>, id: Dbt.userId): Promise<Rpc.ContentInfoItem[]> {
  return await t.any(`select "contentId","contentType",mime_ext,created,updated,published,title,tags from contents where "userId" = '${id}' order by updated desc`);
}

export async function getContentBody(t: ITask<any>, id: Dbt.contentId): Promise<Buffer> {
  let rslt = await t.one(`select content from contents where "contentId" = '${id}' `);
  return rslt.content;
}

export async function saveContent(t: ITask<any>, req: Rpc.SaveContentRequest): Promise<Dbt.Content> {
  let contentId = req.contentId;
  req.title = req.title.replace(/_/g, " ");
  let cont = await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
  let content = req.content ? Utils.textToBuffer(req.content) : cont.content;
  cont = { ...cont, ...req, content };
  return await updateRecord<Dbt.Content>(t, "contents", cont);
}

export async function addContent(t: ITask<any>, req: Rpc.SaveContentRequest, userId: Dbt.userId): Promise<Dbt.Content> {
  let cont = OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("contents"));
  req.title = req.title.replace(/_/g, " ");
  let content = req.content ? Utils.textToBuffer(req.content) : cont.content;
  cont = { ...cont, ...req, content, userId };
  return await insertRecord<Dbt.Content>(t, "contents", cont);
}

export async function registerInvitation(t: ITask<any>, ipAddress: string, linkId: Dbt.linkId): Promise<Dbt.Invitation> {
  return await upsertRecord<Dbt.Invitation>(t, "invitations", { ipAddress, linkId });
}

export async function countRecordsInTable(t: ITask<any>, tblnm: string): Promise<number> {
  let tbl = oxb.tables.get(tblnm);
  if (!tbl) throw new Error("Table not known: " + tblnm);
  let rslt = await t.one("select count(*) as count from " + tblnm);
  return parseInt(rslt.count);
}


