"use strict";

import { ITask } from 'pg-promise';
import { Url, parse, format } from 'url';
import { LargeObjectManager } from 'pg-large-object';
import * as concat from 'concat-stream';

import * as Hasher from '../lib/contentHasher';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as OxiDate from '../lib/oxidate';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../gen/oxigen';
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
  let rec = OxiGen.emptyRec<Dbt.User>("users");
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
  return OxiGen.emptyRec<Dbt.Auth>("auths");
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
  return OxiGen.emptyRec<Dbt.Content>("contents");
}

export function emptyLink(): Dbt.Link {
  return OxiGen.emptyRec<Dbt.Link>("links");
}

export async function getLinksForContentId(t: ITask<any>, id: Dbt.contentId): Promise<Dbt.Link[]> {
  let url = Utils.contentToUrl(id);
  return await t.any(`select * from links where url = '${url}'`);
}

export async function getLinksForUrl(t: ITask<any>, url: Dbt.urlString): Promise<Dbt.Link[]> {
  return await t.any(`select * from links where url = '${url}'`);
}

export async function isPromoted(t: ITask<any>, userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  let rslt = await t.any(`select created from promotions where "userId" = '${userId}' and "linkId" = '${linkId}'`);
  return rslt.length === 1;
}

export async function linkToUrl(t: ITask<any>, linkId: Dbt.linkId): Promise<Dbt.urlString> {
  let link = await retrieveRecord<Dbt.Link>(t, "links", { linkId });
  let contentId = link.contentId;
  let cont = await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
  let desc = cont.title;
  if (desc) desc = desc.replace(/ /g, '_');
  let url = parse(Utils.serverUrl);
  url.path = "/link/" + linkId + (desc ? "#" + desc : '')
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
  let rslt = await t.one(`select count(*) as cnt from promotions where "linkId" = '${linkId}'`);
  return parseInt(rslt.cnt);
}

export async function deliveriesCount(t: ITask<any>, linkId: Dbt.linkId): Promise<number> {
  let rslt = await t.one(`select count(*) as cnt from promotions where "linkId" = '${linkId}' and delivered is not null`);
  return parseInt(rslt.cnt);
}

export async function promoteContent(t: ITask<any>, userId, req: Rpc.PromoteContentRequest): Promise<CacheUpdate[]> {
  let { contentId, amount, tags, comment, title } = req;
  let usr = await retrieveRecord<Dbt.User>(t, "users", { userId });
  if (amount > usr.credits) throw new Error("Negative balances not allowed");
  let cont = await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
  if (userId !== cont.userId) throw new Error("Content owned by different user");
  let rslt: CacheUpdate[] = [];
  let link = OxiGen.emptyRec<Dbt.Link>("links");
  link = { ...link, userId, contentId, tags, url: '', amount, comment, title }
  link = await insertLink(t, link);
  rslt.push({ table: "links" as CachedTable, record: link });
  Array.prototype.push.apply(rslt, await adjustUserBalance(t, usr, -amount));
  return rslt;
}

export async function promoteLink(t: ITask<any>, userId: Dbt.userId, url: string, title, comment: string, amount: Dbt.integer, tags: string[]): Promise<CacheUpdate[]> {
  let usr = await retrieveRecord<Dbt.User>(t, "users", { userId });
  if (amount > usr.credits) throw new Error("Negative balances not allowed");
  let ourl = parse(url);
  let cont = OxiGen.emptyRec<Dbt.Content>("contents");
  let rslt: CacheUpdate[] = [];
  cont = { ...cont, userId, title, contentType: "link", url, content: comment, tags }
  cont = await insertContent(t, cont);
  rslt.push({ table: "contents" as CachedTable, record: cont });
  if (amount > 0) {
    let { contentId } = cont;
    let prevLink = null
    if (Utils.isPseudoQLinkURL(ourl)) {
      prevLink = Utils.getLinkIdFromUrl(parse(url));
      let link = await retrieveRecord<Dbt.Link>(t, "links", { linkId: prevLink });
      url = link.url;
    }
    let link: Dbt.Link = { ...emptyLink(), prevLink, userId, url, comment, contentId, amount, tags };
    link = await insertLink(t, link);
    rslt.push({ table: "links" as CachedTable, record: link });
    Array.prototype.push.apply(rslt, await adjustUserBalance(t, usr, -amount));
  }
  return rslt;
}

export async function redeemLink(t: ITask<any>, link: Dbt.Link): Promise<CacheUpdate[]> {
  let linksToReParent = await t.any(`select * from links where "prevLink" = '${link.linkId}'`)
  let stmt = `update links set "prevLink" = ${link.prevLink ? "'" + link.prevLink + "'" : 'null'} 
              where "prevLink" = '${link.linkId}'`;
  await t.none(stmt);
  await t.none(`delete from links where "linkId" = '${link.linkId}'`);
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
  let rslt = await t.any(`select created from views where "userId" = '${userId}' and "linkId" = '${linkId}'`);
  return rslt.length === 1;
}

export async function viewCount(t: ITask<any>, linkId: Dbt.linkId): Promise<number> {
  let rslt = await t.one(`select count(*) as cnt from views where "linkId" = '${linkId}'`);
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

export async function getUserContents(t: ITask<any>, id: Dbt.userId): Promise<Dbt.Content[]> {
  return await t.any(`select * from contents where "userId" = '${id}' order by updated desc`);
}

export async function insertContent(t: ITask<any>, cont: Dbt.Content): Promise<Dbt.Content> {
  let rslt;
  let contentId;
  while (true) {
    contentId = Utils.genHashId(6);
    let chk = await t.any(`select "contentId" from contents where "contentId" = '${contentId}'`);
    if (chk.length === 0) break;
  }
  cont = { ...cont, contentId };
  return await insertRecord<Dbt.Content>(t, "contents", cont);
}

export async function deleteContent(t: ITask<any>, cont: Dbt.Content) {
  let { contentId, blobId } = cont;
  if (blobId) {
    const man = new LargeObjectManager({ pgPromise: t });
    await man.unlinkAsync(blobId)
  }
  await deleteRecord<Dbt.Content>(t, "contents", { contentId });
}

export async function insertLink(t: ITask<any>, link: Dbt.Link): Promise<Dbt.Link> {
  let rslt;
  let linkId;
  while (true) {
    linkId = Utils.genHashId(6);
    let chk = await t.any(`select "linkId" from links where "linkId" = '${linkId}'`);
    if (chk.length === 0) break;
  }
  link = { ...link, linkId };
  return await insertRecord<Dbt.Link>(t, "links", link);
}

export async function getUniqueContentTitle(t: ITask<any>, userId: Dbt.userId, title: Dbt.title): Promise<Dbt.title> {
  let rslt = title;
  let i = 0;
  while (true) {
    let cont = await t.any(`select "contentId" from contents where title='${rslt.replace("'", "''")}' and "userId" = '${userId}'`);
    if (cont.length === 0) break;
    ++i;
    rslt = title + ` (${i.toString()})`;
  }
  return rslt;
}

export async function insertLargeObject(t: ITask<any>, strm: any): Promise<[number, string]> {
  const man = new LargeObjectManager({ pgPromise: t });
  let [oid, lo_strm] = await man.createAndWritableStreamAsync(16384)
  const hasher = Hasher.create();
  strm.on('data', buf => hasher.update(buf));
  strm.pipe(lo_strm);
  await new Promise(resolve => { lo_strm.on('finish', resolve); });
  const hexDigest = hasher.digest('hex');
  //console.log("lo inserted: " + oid + ", digest: " + hexDigest);
  return [oid, hexDigest];
}

export async function retrieveLargeObject(t: ITask<any>, oid: number): Promise<Buffer> {
  const man = new LargeObjectManager({ pgPromise: t });
  let [size, lo_strm] = await man.openAndReadableStreamAsync(oid, 16384);
  // definitely NQR - needs to be reworked
  let outstrm = concat(gotFile)
  let rslt: Buffer;
  async function gotFile(blob: Buffer) { rslt = blob; };

  lo_strm.pipe(outstrm);
  await new Promise(resolve => { outstrm.on('finish', resolve); });
  return rslt;
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

export async function getCommentsForContent(t: ITask<any>, contentId: Dbt.contentId): Promise<Dbt.Comment[]> {
  return await t.any(`select * from comments where "contentId" = '${contentId}'`)
}

export async function saveTags(t: ITask<any>, tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  await t.any(`INSERT INTO tags(tag) VALUES ('${tags.join("'),('")}') on conflict(tag) do nothing`);
}

export async function registerContentView(t: ITask<any>, userId: Dbt.userId, contentId: Dbt.contentId, ipAddress: Dbt.ipAddress, linkId: Dbt.linkId) {
  let rec = { userId, contentId, ipAddress, linkId };
  return await insertRecord<Dbt.ContentView>(t, "contentviews", rec);
}
