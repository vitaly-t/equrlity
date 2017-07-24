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

export async function insertRecords<T>(t: ITask<any>, tblnm: string, recs: Object[]): Promise<T[]> {
  let tbl = oxb.tables.get(tblnm);
  let rslt: T[] = []
  for (const rec of recs) {
    let stmt = OxiGen.genInsertStatement(tbl, rec);
    let r: T = await t.one(stmt, rec);
    rslt.push(r);
  }
  return rslt;
}

export function upsertRecord<T>(t: ITask<any>, tblnm: string, rec: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genUpsertStatement(tbl, rec);
  return t.one(stmt, rec);
}

export async function upsertRecords<T>(t: ITask<any>, tblnm: string, recs: Object[]): Promise<T[]> {
  let tbl = oxb.tables.get(tblnm);
  let rslt: T[] = []
  for (const rec of recs) {
    let stmt = OxiGen.genUpsertStatement(tbl, rec);
    let r: T[] = await t.any(stmt, rec);
    if (r.length === 1) rslt.push(r[0]);
  }
  return rslt;
}


export async function retrieveRecord<T>(t: ITask<any>, tblnm: string, pk: Object): Promise<T> {
  let tbl = oxb.tables.get(tblnm);
  let stmt = OxiGen.genRetrieveStatement(tbl, pk);
  let rslt = await t.any(stmt, pk);
  if (rslt.length > 0) return rslt[0];
  return null;
}

export async function retrieveBookmark(t: ITask<any>, url: Dbt.urlString, userId: Dbt.userId): Promise<Dbt.Content> {
  let rslt = await t.any(`select * from contents where url = '${url}' and "userId" = '${userId}' and "contentType" = 'bookmark' `);
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

export async function checkProfilePic(t: ITask<any>, profile_pic: Dbt.db_hash, userId: Dbt.userId): Promise<boolean> {
  let rslt: Dbt.Blob[] = await t.any(`select "userId" from blobs where db_hash = '${profile_pic}' `);
  return rslt.length > 0 && rslt[0].userId === userId;
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
  let conts = await t.any(`select "contentId" from contents where url = '${url}'`)
  let ids = conts.map(c => "'" + c.contentId + "'").join(",");
  return await t.any(`select * from links where "contentId" in (${ids}) `);
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

export async function shareContent(t: ITask<any>, userId, req: Rpc.ShareContentRequest): Promise<CacheUpdate[]> {
  let { contentId, amount, tags, comment, title, paymentSchedule } = req;
  let usr = await retrieveRecord<Dbt.User>(t, "users", { userId });
  if (amount > usr.credits) amount = usr.credits; //throw new Error("Negative balances not allowed");
  let cont = await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
  if (!cont) throw new Error("Content not found");
  if (userId !== cont.userId) throw new Error("Content owned by different user");
  let prevLink: Dbt.linkId;
  if (cont.contentType === "bookmark") {
    let url = parse(cont.url);
    if (Utils.isPseudoQLinkURL(url)) {
      if (paymentSchedule && paymentSchedule.length > 0) throw new Error("Payment schedule not applicable to PseudoQURL bookmark");
      prevLink = Utils.getLinkIdFromUrl(url);
    }
  }
  if (amount > 0) {
    if (!paymentSchedule || paymentSchedule.length === 0 || paymentSchedule.findIndex(i => i < 0) < 0) throw new Error("Payment schedule permits no use for investment");
  }
  let rslt: CacheUpdate[] = [];
  let link = OxiGen.emptyRec<Dbt.Link>("links");
  link = { ...link, userId, contentId, tags, amount, comment, title, prevLink, paymentSchedule }
  link = await insertLink(t, link);
  rslt.push({ table: "links" as CachedTable, record: link });
  Array.prototype.push.apply(rslt, await adjustUserBalance(t, usr, -amount));
  return rslt;
}

export async function redeemLink(t: ITask<any>, link: Dbt.Link): Promise<CacheUpdate[]> {
  return investInLink(t, link, -link.amount);
}

export async function investInLink(t: ITask<any>, link: Dbt.Link, adj: Dbt.integer): Promise<CacheUpdate[]> {
  let amount = link.amount + adj;
  if (amount < 0) throw new Error("Negative investments not allowed");
  //if (amount == 0) {
  //  return await redeemLink(t, link);
  //}
  let rslt: CacheUpdate[] = [];
  let user = await retrieveRecord<Dbt.User>(t, "users", { userId: link.userId });
  Array.prototype.push.apply(rslt, await adjustUserBalance(t, user, -adj));
  let newlink = { ...link, amount };
  newlink = await updateRecord<Dbt.Link>(t, "links", newlink);
  rslt.push({ table: "links" as CachedTable, record: newlink });
  return rslt;
}

export async function updateLink(t: ITask<any>, link: Dbt.Link, prv: Dbt.Link): Promise<CacheUpdate[]> {
  let adj = link.amount - (prv ? prv.amount : 0);
  let rslt: CacheUpdate[] = [];
  if (adj !== 0) {
    let user = await retrieveRecord<Dbt.User>(t, "users", { userId: link.userId });
    if (user.credits - adj < 0) throw new Error("User has insufficient credits");
    Array.prototype.push.apply(rslt, await adjustUserBalance(t, user, -adj));
  }
  let newlink = await updateRecord<Dbt.Link>(t, "links", link);
  rslt.push({ table: "links" as CachedTable, record: newlink });
  return rslt;
}

export async function removeLink(t: ITask<any>, link: Dbt.Link): Promise<void> {
  let { amount, linkId } = link;
  if (amount) throw new Error("Link must be redeemed first");
  await deleteRecord<Dbt.Link>(t, "links", { linkId });
}

export async function getUserShares(t: ITask<any>, userId: Dbt.userId, last_feed?: Date): Promise<Dbt.Link[]> {
  if (last_feed) return await t.any(`select * from links where "userId" = '${userId}' and updated > $1 order by created desc`, [last_feed]);
  return await t.any(`select * from links where "userId" = '${userId}' order by created desc`);
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

async function payTransitLinks(t: ITask<any>, links: Dbt.Link[], viewerId: Dbt.userId, amountSent: Dbt.integer): Promise<[Dbt.integer, CacheUpdate[]]> {
  if (amountSent <= 0) return [amountSent, []];
  let rslt: CacheUpdate[] = [];
  let l = links.length - 1;
  let amount = amountSent;
  for (let i = 0; i < l; ++i) {
    if (amount <= 0) return
    let link = links[i];
    await insertRecord(t, "views", { userId: viewerId, linkId: link.linkId, payment: 1 });
    link = await updateRecord<Dbt.Link>(t, "links", { ...link, amount: link.amount + 1 });
    rslt.push({ table: "links" as CachedTable, record: link });
    --amount;
  }
  return [amount, rslt];
}

export async function payForView(t: ITask<any>, links: Dbt.Link[], viewerId: Dbt.userId, amountSent: Dbt.integer): Promise<CacheUpdate[]> {
  let [amountRemaining, rslt] = await payTransitLinks(t, links, viewerId, amountSent);

  let viewer = await retrieveRecord<Dbt.User>(t, "users", { userId: viewerId });
  let l = links.length - 1;
  let link = links[l];
  let sched = link.paymentSchedule;
  let views: Dbt.integer = sched ? sched.length : 0;
  if (sched && sched.length > 0) {
    let r = await t.one(`select count(*) as cnt from views where "userId" = '${viewerId}' and "linkId" = '${link.linkId}' `);
    views = parseInt(r.cnt);
  }
  if (sched && views < sched.length) {
    let amt = sched[views];
    if (amt > amountRemaining) throw new Error(`Expecting payment of ${amt}, but received only ${amountRemaining}.`)
    amountRemaining -= amt;
    if (amt < 0) { //link pays viewer
      if (link.amount + amt < 0) throw new Error("link has insufficient credits to pay viewer");  //nqr - viewer is denied access as well as not getting paid
    }
    else if (viewer.credits < amt) throw new Error("viewer has insufficient credits to pay link");
    await insertRecord(t, "views", { userId: viewerId, linkId: link.linkId, payment: amt });
    let amount = link.amount + amt;
    let r = await updateRecord<Dbt.Link>(t, "links", { ...link, amount });
    rslt.push({ table: "links" as CachedTable, record: r });

    if (views === sched.length - 1) {  // schedule completed
      let contentId = link.contentId;
      let cont = await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
      cont = { ...cont, userId: viewerId, contentId: '' };
      cont = await insertContent(t, cont);
      rslt.push({ table: "contents" as CachedTable, record: cont });
    }
  }
  else {
    await insertRecord(t, "views", { userId: viewerId, linkId: link.linkId });
    link = await updateRecord<Dbt.Link>(t, "links", { ...link, amount: link.amount + 1 });
    rslt.push({ table: "links" as CachedTable, record: link });
    --amountRemaining;
  }
  if (amountRemaining < 0) throw new Error("Insufficient amount for payforView");
  if (amountRemaining !== 0) {
    console.log(`Warning: Incorrect amount for payforView. Sent ${amountSent}, remainder: ${amountRemaining}`);
  }
  let credits = viewer.credits - (amountSent - amountRemaining);
  viewer = { ...viewer, credits }
  viewer = await updateRecord<Dbt.User>(t, "users", viewer);
  rslt.push({ table: "users" as CachedTable, record: viewer });
  return rslt;
}

export async function purchaseContent(t: ITask<any>, links: Dbt.Link[], viewerId: Dbt.userId, amountSent: Dbt.integer): Promise<CacheUpdate[]> {
  let [amountRemaining, rslt] = await payTransitLinks(t, links, viewerId, amountSent);

  let viewer = await retrieveRecord<Dbt.User>(t, "users", { userId: viewerId });
  let l = links.length - 1;
  let link = links[l];
  let sched = link.paymentSchedule;
  if (sched && sched.length > 0) {
    let l: Dbt.integer = parseInt((await t.one(`select count(*) as cnt from views where "userId" = '${viewerId}' and "linkId" = '${link.linkId}' `)).cnt);
    let acc = 0;
    while (l < sched.length) {
      let amt = sched[l];
      acc += amt;
      await insertRecord<Dbt.View>(t, "views", { userId: viewerId, linkId: link.linkId, payment: amt });
      ++l
    }
    if (acc !== amountRemaining) throw new Error(`Expecting payment of ${acc}, but received ${amountRemaining} instead.`)
    //link pays viewer
    if (acc < 0 && link.amount + acc < 0) throw new Error("link has insufficient credits to pay viewer");  //nqr - viewer is denied access as well as not getting paid
    let credits = viewer.credits - amountSent;
    viewer = { ...viewer, credits }
    viewer = await updateRecord<Dbt.User>(t, "users", viewer);
    rslt.push({ table: "users" as CachedTable, record: viewer });

    let amount = link.amount + acc;
    let r = await updateRecord<Dbt.Link>(t, "links", { ...link, amount });
    rslt.push({ table: "links" as CachedTable, record: r });

    let contentId = link.contentId;
    let cont = await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
    cont = { ...cont, userId: viewerId, contentId: '' };
    cont = await insertContent(t, cont);
    rslt.push({ table: "contents" as CachedTable, record: cont });
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

export async function getUserContents(t: ITask<any>, id: Dbt.userId, last_feed?: Date): Promise<Dbt.Content[]> {
  if (last_feed) return await t.any(`select * from contents where "userId" = '${id}' and updated > $1 order by created desc`, [last_feed]);
  return await t.any(`select * from contents where "userId" = '${id}' order by created desc`);
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

export async function deleteContent(t: ITask<any>, cont: Dbt.Content): Promise<void> {
  let { contentId, db_hash } = cont;
  await deleteRecord<Dbt.Content>(t, "contents", { contentId });
  if (db_hash) {
    let chk = await t.any(`select "contentId" from contents where db_hash = '${db_hash}'`);
    if (chk.length === 0) { // don't delete blob if any other refs
      // assert chk[0].contentId === contentId?
      let blob: Dbt.Blob = await t.one(`select "blobId" from blobs where db_hash = '${db_hash}'`);
      const man = new LargeObjectManager({ pgPromise: t });
      await man.unlinkAsync(blob.blobId)
      await deleteRecord<Dbt.Blob>(t, "blobs", { db_hash });
    }
  }
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

export async function insertLargeObject(t: ITask<any>, userId: Dbt.userId, strm: any): Promise<Dbt.Blob> {
  const man = new LargeObjectManager({ pgPromise: t });
  let [blobId, lo_strm] = await man.createAndWritableStreamAsync(16384)
  const hasher = Hasher.create();
  strm.on('data', buf => hasher.update(buf));
  strm.pipe(lo_strm);
  await new Promise(resolve => { lo_strm.on('finish', resolve); });
  const db_hash = hasher.digest('hex');
  //console.log("lo inserted: " + oid + ", digest: " + hexDigest);
  let blob: Dbt.Blob = OxiGen.emptyRec<Dbt.Blob>("blobs");
  blob = { ...blob, db_hash, userId, blobId };
  try {
    blob = await insertRecord<Dbt.Blob>(t, "blobs", blob);
  }
  catch (e) {
    //TODO: check that error is actually primary key violation (duplicate hash)
    await man.unlinkAsync(blobId);
    throw (e);
  }
  return blob;
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

export async function retrieveBlob(t: ITask<any>, db_hash: Dbt.db_hash): Promise<Buffer> {
  let blob = await retrieveRecord<Dbt.Blob>(t, "blobs", { db_hash });
  let blobId = blob.blobId;
  return await retrieveLargeObject(t, blobId);
}

export async function updateAudioPeaks(t: ITask<any>, db_hash: Dbt.db_hash, peaks: Dbt.text, userId: Dbt.userId): Promise<void> {
  let blob = await retrieveRecord<Dbt.Blob>(t, "blobs", { db_hash });
  if (blob.userId !== userId) throw new Error("incorrect owner for peaks data");
  blob = { ...blob, peaks }
  await updateRecord(t, "blobs", blob);
}

export async function getAudioPeaks(t: ITask<any>, db_hash: Dbt.db_hash): Promise<Dbt.text> {
  let blob = await retrieveRecord<Dbt.Blob>(t, "blobs", { db_hash });
  return blob.peaks;
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

export async function bookmarkLink(t: ITask<any>, userId: Dbt.userId, contentId: Dbt.contentId, title: string, tags: string[], url: Dbt.urlString, comment: string): Promise<Dbt.Content> {
  let content: Dbt.Content;
  if (contentId) {
    content = await retrieveRecord<Dbt.Content>(t, "contents", { contentId });
    if (content.userId !== userId) throw new Error("Bookmark belongs to different user");
    content = { ...content, title, tags, url, content: comment }
    content = await updateRecord<Dbt.Content>(t, "contents", content);
  }
  else {
    content = OxiGen.emptyRec<Dbt.Content>("contents");
    content = { ...content, title, tags, url, userId, content: comment, contentType: "bookmark" }
    content = await insertContent(t, content);
  }
  return content;
}

export async function handleBookmarkLink(t: ITask<any>, userId: Dbt.userId, req: Rpc.BookmarkLinkRequest): Promise<Rpc.BookmarkLinkResponse> {
  let { contentId, title, tags, url, comment } = req;
  let content = await bookmarkLink(t, userId, contentId, title, tags, url, comment);
  let link;
  if (req.share) {
    let { comment, tags, title, signature } = req;
    let contentId = content.contentId;
    link = OxiGen.emptyRec<Dbt.Link>("links");
    link = { ...link, userId, contentId, tags, amount: 0, comment, title }
    link = await insertLink(t, link);
  }
  return { content, link };
}

export async function dismissFeeds(t: ITask<any>, userId: Dbt.userId, urls: Dbt.urlString[], save: boolean): Promise<void> {
  let ourls = urls.map(u => parse(u));
  let linkIds = ourls.map(Utils.getLinkIdFromUrl);
  let s = linkIds.map(l => "'" + l + "'").join();
  if (save) {
    let links: Dbt.Link[] = await t.any(`select * from links where "linkId" in (${s})`)
    for (var i = 0; i < urls.length; ++i) {
      let url = urls[i];
      let link = links[i];
      let cont = OxiGen.emptyRec<Dbt.Content>("contents");
      let { tags, title, comment } = link;
      cont = { ...cont, title, tags, url, userId, content: comment, contentType: "bookmark" };
      await insertContent(t, cont);
    }
  }
  let now = new Date();
  await t.any(`update feeds set dismissed = $1 where "userId" = '${userId}' and "linkId" in (${s})`, [now]);
}

export async function getCommentsFeed(t: ITask<any>, userId: Dbt.userId, last_feed: Date): Promise<Dbt.Comment[]> {
  let tbl = oxb.tables.get("comments");
  let cols = OxiGen.columnNames(tbl);
  let stmt = `
with cmts as (
   select a.*,b."userId" as "ownerId" 
   from comments a
   join contents b on a."contentId" = b."contentId"
   where (a.created > $1 or a.updated > $1)
)
select ${cols.join()} from cmts where "ownerId" = '${userId}'
`
  let comments: Dbt.Comment[] = await t.any(stmt, [last_feed]);
  return comments;
}

