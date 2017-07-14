"use strict";

import { Url, parse, format } from 'url';
import { IMain, IDatabase, ITask } from 'pg-promise';
import * as pgPromise from 'pg-promise';
import { createWriteStream, createReadStream } from 'fs';

import * as OxiGen from '../gen/oxigen';
import { genInsertStatement } from "../gen/oxigen";

import * as Utils from "../lib/utils";
import * as Rpc from '../lib/rpc';
import * as OxiDate from '../lib/oxidate';
import * as Dbt from '../lib/datatypes'
import * as uuid from '../lib/uuid.js';
//import { buildWaveform } from '../lib/waveform';

import * as cache from './cache';
import * as tasks from './pgtasks';

export let connectUrl: string =
  Utils.isTest() ? process.env.DEV_PSEUDOQURL_TEST_URL
    : Utils.isStaging() ? process.env.STAGING_PSEUDOQURL_URL
      : Utils.isDev() ? process.env.DEV_PSEUDOQURL_URL
        : process.env.PSEUDOQURL_URL;
if (!connectUrl.startsWith('postgres:')) connectUrl = 'postgres:' + connectUrl;

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

export const pgp: IMain = pgPromise({
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


const db: IDatabase<any> = pgp(connectUrl);

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
        console.log("creating table " + t.name);
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
            let stmt = `ALTER TABLE "${t.name}" ADD COLUMN "${c.name}" ${c.type.sqlType + (c.multiValued || c.type.multiValued ? '[]' : '')} `;
            await db.none(stmt);
          }
        })
        let cons: Array<any> = await db.any(`
          select constraint_name,constraint_type from information_schema.table_constraints 
          where table_schema = 'public' and table_name = '${OxiGen.cnm(t.name)}'
          and constraint_type in ('PRIMARY KEY','FOREIGN KEY','UNIQUE')
        `);
        let pkName = OxiGen.pkName(t);
        cons.forEach(async c => {
          let dropit = (c.constraint_type === 'PRIMARY KEY' && pkName !== c.constraint_name)
            || (c.constraint_type === 'FOREIGN KEY' && t.foreignKeys.findIndex(fk => OxiGen.fkName(t, fk) === c.constraint_name) < 0)
            || (c.constraint_type === 'UNIQUE' && t.uniques.findIndex(nms => OxiGen.unqName(t, nms) === c.constraint_name) < 0);
          if (dropit) {
            console.log("dropping constraint " + c.constraint_name);
            await db.none(`ALTER TABLE public.${t.name} DROP CONSTRAINT ${OxiGen.cnm(c.constraint_name)}`)
          }
        })
        if (cons.findIndex(v => v.constraint_type === 'PRIMARY KEY' && v.constraint_name === pkName) < 0) {
          console.log(`Adding primary key to table ${t.name}`);
          await db.none(OxiGen.genAddPrimaryKeyStatement(t));
        }
        t.foreignKeys.forEach(async fk => {
          let nm = OxiGen.fkName(t, fk);
          if (cons.findIndex(v => v.constraint_type === 'FOREIGN KEY' && v.constraint_name === nm) < 0) {
            console.log(`Adding foreign key ${nm} to table ${t.name}`);
            let stmt = OxiGen.genAddForeignKeyStatement(t, fk);
            await db.none(stmt);
          }
        });
        t.uniques.forEach(async nms => {
          let nm = OxiGen.unqName(t, nms);
          if (cons.findIndex(v => v.constraint_type === 'UNIQUE' && v.constraint_name === nm) < 0) {
            console.log(`Adding unique ${nm} to table ${t.name}`);
            let stmt = OxiGen.genAddUniqueStatement(t, nms);
            await db.none(stmt);
          }
        });
      }
    });
  }
  await initCache();
}

export async function initCache() {
  let userRows: Array<Dbt.User> = await db.any("select * from users;");
  let authRows: Array<Dbt.Auth> = await db.any("select * from auths");
  let contentRows: Array<Dbt.Content> = await db.any("select * from contents");
  let commentRows: Array<Dbt.Comment> = await db.any("select * from comments");
  let linkRows: Dbt.Link[] = await db.any('select * from links order by "linkId" ');
  cache.init(userRows, contentRows, linkRows, commentRows);
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
  return await db.task(t => tasks.updateRecord(t, tblnm, rec));
}

export async function insertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  return await db.task(t => tasks.insertRecord(t, tblnm, rec));
}

export async function insertRecords<T>(tblnm: string, recs: Object[]): Promise<T[]> {
  return await db.task(t => tasks.insertRecords(t, tblnm, recs));
}

export async function upsertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  return await db.task(t => tasks.upsertRecord(t, tblnm, rec));
}

export async function upsertRecords<T>(tblnm: string, recs: Object[]): Promise<T[]> {
  return await db.task(t => tasks.upsertRecords(t, tblnm, recs));
}

export async function retrieveRecord<T>(tblnm: string, pk: Object): Promise<T> {
  return await db.task(t => tasks.retrieveRecord(t, tblnm, pk));
}

export async function countRecordsInTable(tblnm: string): Promise<number> {
  return await db.task(t => tasks.countRecordsInTable(t, tblnm));
}

export async function retrieveBookmark(url: Dbt.urlString, userId: Dbt.userId): Promise<Dbt.Content> {
  return await db.task(t => tasks.retrieveBookmark(t, url, userId));
}

export async function deleteRecord<T>(tblnm: string, pk: Object): Promise<boolean> {
  return await db.task(t => tasks.deleteRecord(t, tblnm, pk));
}

export async function getAllRecords<T>(tblnm: string): Promise<T[]> {
  return await db.task(t => tasks.getAllRecords(t, tblnm));
}

export async function checkMonikerUsed(name: string): Promise<boolean> {
  return await db.task(t => tasks.checkMonikerUsed(t, name));
};

export async function checkProfilePic(profile_pic: Dbt.db_hash, userId: Dbt.userId): Promise<boolean> {
  return await db.task(t => tasks.checkProfilePic(t, profile_pic, userId));
};

export async function getAllAnonymousMonikers(): Promise<Dbt.userName[]> {
  return await db.task(t => tasks.getAllAnonymousMonikers(t));
};

export async function upsertUser(usr: Dbt.User): Promise<cache.CacheUpdate[]> {
  return await db.task(t => tasks.upsertUser(t, usr));
}

export async function findUserByName(name: string): Promise<Dbt.User | null> {
  return await db.task(t => tasks.findUserByName(t, name));
};

export async function adjustUserBalance(usr: Dbt.User, adj: Dbt.integer): Promise<cache.CacheUpdate[]> {
  return await db.task(t => tasks.adjustUserBalance(t, usr, adj));
}

export async function createAuth(authId: Dbt.authId, userId: Dbt.userId, provider: Dbt.authProvider): Promise<cache.CacheUpdate[]> {
  return await db.task(t => tasks.createAuth(t, authId, userId, provider));
}

export async function getUserIdByAuthId(provider: Dbt.authProvider, authId: Dbt.authId): Promise<Dbt.userId | null> {
  return await db.task(t => tasks.getUserIdByAuthId(t, provider, authId));
}

export async function getUserByAuthId(authId: string, provider: Dbt.authProvider): Promise<Dbt.User | null> {
  return await db.task(t => tasks.getUserByAuthId(t, authId, provider));
}

export async function touchUser(userId: Dbt.userId) {
  let rslt = await db.task(t => tasks.touchUser(t, userId));
  cache.setUser(rslt);
}

export async function getLinksForUrl(url: Dbt.urlString): Promise<Dbt.Link[]> {
  return await db.task(t => tasks.getLinksForUrl(t, url));
}

export async function isPromoted(userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  return await db.task(t => tasks.isPromoted(t, userId, linkId));
}

export async function deliverNewPromotions(userId: Dbt.userId): Promise<Dbt.urlString[]> {
  return await db.task(t => tasks.deliverNewPromotions(t, userId));
}

export async function promotionsCount(linkId: Dbt.linkId): Promise<number> {
  return await db.task(t => tasks.promotionsCount(t, linkId));
}

export async function deliveriesCount(linkId: Dbt.linkId): Promise<number> {
  return await db.task(t => tasks.deliveriesCount(t, linkId));
}

async function _getPromotionLinks(t: ITask<any>, link: Dbt.Link, maxLen: Dbt.integer = cache.rowCount("users")): Promise<Dbt.userId[]> {
  let grph = cache.userlinks;
  if (!grph.has(link.userId)) return;
  let rem = maxLen;
  let rslt: Dbt.userId[] = [];
  let s = new Set<Dbt.userId>();
  s.add(link.userId);
  let q = Utils.shuffle<Dbt.userId>(grph.get(link.userId));
  let linkId = link.linkId
  while (q.length > 0) {
    let userId = q.shift();
    if (rslt.indexOf(userId) < 0) {
      let done = await tasks.isPromoted(t, userId, linkId);
      if (!done) {
        rslt.push(userId);
        rem -= 1;
      }
    }
    if (rem == 0) break;
    s.add(userId);
    if (grph.has(userId)) {
      Utils.shuffle<Dbt.userId>(grph.get(userId)).forEach(u => {
        if (!s.has(u)) q.push(u);
      })
    }
  }
  return rslt;
}

export async function getPromotionLinks(link: Dbt.Link, maxLen: Dbt.integer = cache.rowCount("users")): Promise<Dbt.userId[]> {
  return await db.task(t => _getPromotionLinks(t, link, maxLen));
}

async function _promoteLink(t: ITask<any>, link: Dbt.Link, amount: Dbt.integer): Promise<void> {
  let linkId = link.linkId;
  let grph = cache.userlinks;
  if (!grph.has(link.userId)) return;
  let inc = cache.getLinkDepth(link) + 1;
  if (amount < inc) return;
  let max = Math.floor(amount / inc);
  let ids = await _getPromotionLinks(t, link, max);
  for (const userId of ids) {
    await tasks.insertRecord(t, "promotions", { linkId, userId });
  }
}

export async function promoteLink(link: Dbt.Link, amount: Dbt.integer): Promise<void> {
  return await db.task(t => _promoteLink(t, link, amount));
}

export async function redeemLink(link: Dbt.Link): Promise<void> {
  cache.update(await db.task(t => tasks.redeemLink(t, link)));
}

export async function removeLink(link: Dbt.Link): Promise<void> {
  await db.task(t => tasks.removeLink(t, link));
  cache.deleteLink(link);
}

export async function investInLink(link: Dbt.Link, adj: Dbt.integer): Promise<void> {
  cache.update(await db.task(t => tasks.investInLink(t, link, adj)));
}

export async function updateLink(link: Dbt.Link): Promise<void> {
  let prv = cache.links.get(link.linkId);
  cache.update(await db.task(t => tasks.updateLink(t, link, prv)));
}

export async function getLinksForUser(userId: Dbt.userId): Promise<Dbt.Link[]> {
  return await db.task(t => tasks.getLinksForUser(t, userId));
}

export async function hasViewed(userId: Dbt.userId, linkId: Dbt.linkId): Promise<boolean> {
  return await db.task(t => tasks.hasViewed(t, userId, linkId));
}

export async function viewCount(linkId: Dbt.linkId): Promise<number> {
  return await db.task(t => tasks.viewCount(t, linkId));
}

export async function getLinkAlreadyInvestedIn(userId: Dbt.userId, contentId: Dbt.contentId): Promise<Dbt.linkId | null> {
  let url = Utils.contentToUrl(contentId);
  return await db.task(t => tasks.getLinkAlreadyInvestedIn(t, userId, url));
}

export async function payForView(viewerId: Dbt.userId, viewedLinkId: Dbt.linkId, amount: Dbt.integer): Promise<void> {
  let links = cache.getChainFromLinkId(viewedLinkId);
  let viewedLink = links[0];
  if (viewerId !== viewedLink.userId) {
    cache.connectUsers(viewerId, viewedLink.userId);
    cache.update(await db.tx(t => tasks.payForView(t, links, viewerId, amount)));
  }
}

export async function purchaseContent(viewerId: Dbt.userId, viewedLinkId: Dbt.linkId, amount: Dbt.integer): Promise<Dbt.Content | null> {
  let links = cache.getChainFromLinkId(viewedLinkId);
  let viewedLink = links[0];
  if (viewerId === viewedLink.userId) return null;
  cache.connectUsers(viewerId, viewedLink.userId);
  let updts = await db.tx(t => tasks.purchaseContent(t, links, viewerId, amount));
  cache.update(updts);
  let content: Dbt.Content = updts.find(e => e.table === "contents" as cache.CachedTable).record;
  return content;
}

export async function createUser(email?: string): Promise<Dbt.User> {
  let user = await db.task(t => tasks.createUser(t, email));
  console.log("user created : " + user.userName);
  if (cache.users.has(user.userId)) {
    throw new Error("cache is cactus");
  }
  cache.setUser(user);
  return user;
};

async function _handlePromoteContent(t: ITask<any>, userId, req: Rpc.PromoteContentRequest): Promise<[cache.CacheUpdate[], Rpc.PromoteContentResponse]> {
  let updts = await tasks.promoteContent(t, userId, req);
  let link: Dbt.Link = updts.find(e => e.table === "links" as cache.CachedTable).record;
  await _promoteLink(t, link, req.amount);
  if (link.prevLink) {
    let prev = cache.links.get(link.prevLink);
    cache.connectUsers(userId, prev.userId);
  }
  let rsp: Rpc.PromoteContentResponse = { link };
  return [updts, rsp];
}

export async function handlePromoteContent(userId, req: Rpc.PromoteContentRequest): Promise<Rpc.PromoteContentResponse> {
  let pr = await db.tx(t => _handlePromoteContent(t, userId, req));
  let updts: cache.CacheUpdate[] = pr[0];
  let rsp: Rpc.PromoteContentResponse = pr[1];
  cache.update(updts);
  return rsp;
}

/*
async function _handlePromoteLink(t: ITask<any>, userId, req: Rpc.PromoteLinkRequest): Promise<[cache.CacheUpdate[], Rpc.PromoteLinkResponse]> {
  let { url, signature, title, comment, amount, tags } = req;
  let ourl = parse(url);
  let linkId = '';
  let link = null;
  let linkDepth = 0;
  let rslt: cache.CacheUpdate[] = [];
  saveTags(tags);
  if (Utils.isPseudoQLinkURL(ourl)) {
    linkId = Utils.getLinkIdFromUrl(ourl);
    link = cache.links.get(linkId);
    linkDepth = cache.getLinkDepth(link);

    if (link.userId === userId) {
      console.log("investing in link: " + linkId);
      rslt = await tasks.investInLink(t, link, amount);
    }
    else {
      cache.connectUsers(userId, link.userId);
      let prevId = await tasks.getLinkAlreadyInvestedIn(t, userId, url);
      if (prevId) throw new Error("user has previously invested in this content");
      rslt = await tasks.promoteLink(t, userId, url, title, comment, amount, tags);
      linkDepth += 1;
    }
  }
  else {
    rslt = await tasks.promoteLink(t, userId, url, title, comment, amount, tags);
  }
  if (amount == 0) return [rslt, { link: null, linkDepth: -1 }];

  link = rslt.find(e => e.table === "links" as cache.CachedTable).record;
  if (!link) throw new Error("no link generated");
  await _promoteLink(t, link, amount);
  let linkPromoter = cache.users.get(userId).userName;
  return [rslt, { link, linkDepth }];
}
*/

export async function bookmarkAndPromoteLink(userId, req: Rpc.BookmarkLinkRequest): Promise<Rpc.PromoteContentResponse> {
  let cont: Dbt.Content;
  let pr = await db.tx(async t => {
    let { contentId, comment, tags, title, signature, url } = req;
    cont = await tasks.bookmarkLink(t, userId, contentId, title, tags, url, comment);
    contentId = cont.contentId;
    let preq: Rpc.PromoteContentRequest = { contentId, comment, tags, title, amount: 0, signature, paymentSchedule: [] };  //TODO: fixup signature mangling here
    return await _handlePromoteContent(t, userId, preq);
  });
  let updts: cache.CacheUpdate[] = pr[0];
  let rsp: Rpc.PromoteContentResponse = pr[1];
  updts.unshift({ table: "contents", record: cont });
  cache.update(updts);
  return rsp;
}

export async function handleBookmarkLink(userId, req: Rpc.BookmarkLinkRequest): Promise<Rpc.BookmarkLinkResponse> {
  let rsp: Rpc.BookmarkLinkResponse = await db.task(t => tasks.handleBookmarkLink(t, userId, req));
  let updts: cache.CacheUpdate[] = [{ table: "contents", record: rsp.content }]
  if (rsp.link) updts.push({ table: "links", record: rsp.link });
  cache.update(updts);
  return rsp;
}

async function _getUserLinkItem(t: ITask<any>, linkId: Dbt.linkId): Promise<Rpc.UserLinkItem> {
  let link = cache.links.get(linkId);
  let linkDepth = cache.getLinkDepth(link);
  let viewCount = await tasks.viewCount(t, linkId);
  let promotionsCount = await tasks.promotionsCount(t, linkId);
  let deliveriesCount = await tasks.deliveriesCount(t, linkId);
  let rl: Rpc.UserLinkItem = { link, linkDepth, viewCount, promotionsCount, deliveriesCount };
  return rl;
}

export async function getUserLinkItem(linkId: Dbt.linkId): Promise<Rpc.UserLinkItem> {
  return await db.task(t => _getUserLinkItem(t, linkId));
}

async function _getUserLinks(t: ITask<any>, id: Dbt.userId): Promise<Rpc.UserLinkItem[]> {
  let a = await tasks.getLinksForUser(t, id);
  let rslt: Rpc.UserLinkItem[] = []
  for (const link of a) rslt.push(await _getUserLinkItem(t, link.linkId))
  return rslt;
}

export async function getUserLinks(id: Dbt.userId): Promise<Rpc.UserLinkItem[]> {
  return await db.task(t => _getUserLinks(t, id));
}

export async function getUserContents(id: Dbt.userId): Promise<Dbt.Content[]> {
  return await db.task(t => tasks.getUserContents(t, id));
}

export async function registerInvitation(ipAddress: string, linkId: Dbt.linkId): Promise<Dbt.Invitation> {
  return await db.tx(t => tasks.registerInvitation(t, ipAddress, linkId));
}

export async function insertContent(cont: Dbt.Content): Promise<Dbt.Content> {
  return await db.task(async t => {
    let rslt = await tasks.insertContent(t, cont);
    cache.setContent(rslt);
    return rslt;
  });
}

export async function deleteContent(cont: Dbt.Content): Promise<void> {
  return await db.tx(t => tasks.deleteContent(t, cont));
}

export async function insertBlobContent(strm: any, content: string, mime_ext: string, contentType: Dbt.contentType, title: string, peaks: Dbt.text, userId: Dbt.userId): Promise<Dbt.Content> {
  return await db.tx(async t => {
    let blob = await tasks.insertLargeObject(t, userId, strm);
    let buf = await tasks.retrieveLargeObject(t, blob.blobId);
    //if (!peaks) peaks = await buildWaveform(buf.buffer);
    if (peaks) await tasks.updateAudioPeaks(t, blob.db_hash, peaks, userId);
    let cont = OxiGen.emptyRec<Dbt.Content>("contents");
    title = await tasks.getUniqueContentTitle(t, userId, title);
    cont = { ...cont, mime_ext, content, contentType, title, userId, db_hash: blob.db_hash };
    return await tasks.insertContent(t, cont);
  });
}

export async function retrieveBlobContent(contentId: Dbt.contentId): Promise<Buffer> {
  return await db.tx(async t => {
    let cont = await tasks.retrieveRecord<Dbt.Content>(t, "contents", { contentId });
    if (!cont.db_hash) return null;
    return await tasks.retrieveBlob(t, cont.db_hash);
  });
}

export async function retrieveBlob(db_hash: Dbt.db_hash): Promise<Buffer> {
  //NB must use tx when dealing with large objects.
  return await db.tx(t => tasks.retrieveBlob(t, db_hash));
}

export async function updateAudioPeaks(db_hash: Dbt.db_hash, peaks: Dbt.text, userId: Dbt.userId): Promise<void> {
  return await db.task(t => tasks.updateAudioPeaks(t, db_hash, peaks, userId));
}

export async function getAudioPeaks(db_hash: Dbt.db_hash): Promise<Dbt.text> {
  return await db.task(t => tasks.getAudioPeaks(t, db_hash));
}

/*
export async function buildMissingWaveforms(): Promise<void> {
  let conts: Dbt.Content[] = await db.any(`select * from contents where "contentType" = 'audio'`);
  for (const o of conts) {
    let blob = await getAudioPeaks(o.db_hash);
    //if (!blob) {
    let buf = await retrieveBlobContent(o.contentId);
    //let peaks = await buildWaveform(buf.buffer);
    await updateAudioPeaks(o.db_hash, peaks, o.userId);
    //}
  }
}
*/

export async function getCommentsForContent(contentId: Dbt.contentId): Promise<Dbt.Comment[]> {
  return await db.task(t => tasks.getCommentsForContent(t, contentId));
}

export async function registerContentView(userId: Dbt.userId, contentId: Dbt.contentId, ipAddress: Dbt.ipAddress, linkId: Dbt.linkId) {
  return await db.task(t => tasks.registerContentView(t, userId, contentId, ipAddress, linkId));
}

export async function saveUserFollowings(userId: Dbt.userId, follows: Dbt.userName[]): Promise<void> {
  let user = cache.users.get(userId);
  let following = follows.map(nm => cache.getUserByName(nm).userId);
  user = { ...user, following }
  await updateRecord("users", user);
  cache.setUser(user);
}

function _feedFilter(usr: Dbt.User, l: Dbt.Link): boolean {
  let { subscriptions, blacklist, following } = usr;
  if (subscriptions && subscriptions.findIndex(t => l.tags && l.tags.indexOf(t) >= 0) >= 0) return true;
  if (following && following.indexOf(l.userId) >= 0) {
    return !(blacklist && blacklist.findIndex(t => l.tags && l.tags.indexOf(t) >= 0) >= 0);
  }
  return false;
}

async function _updateUserFeeds(t: ITask<any>, userId: Dbt.userId, links: Dbt.Link[]): Promise<Dbt.Feed[]> {
  let usr = cache.users.get(userId)
  let now = new Date();
  let f = OxiGen.emptyRec<Dbt.Feed>("feeds");
  let feeds = links.filter(l => _feedFilter(usr, l))
    .map(l => { return { ...f, userId, linkId: l.linkId }; });
  await tasks.upsertRecords<Dbt.Feed>(t, "feeds", feeds);
  usr = { ...usr, last_feed: now };
  usr = await tasks.updateRecord<Dbt.User>(t, "users", usr);
  cache.setUser(usr);
  return feeds;
}

function _convertLinksToFeeds(userId: Dbt.userId, feeds: Dbt.Feed[]): Rpc.FeedItem[] {
  let rslt: Rpc.FeedItem[] = [];
  for (const f of feeds) {
    let l: Dbt.Link = cache.links.get(f.linkId);
    let { tags, created, comment } = l;
    let source = cache.users.get(l.userId).userName;
    let url = Utils.linkToUrl(l.linkId, l.title);
    let itm: Rpc.FeedItem = { type: "squawk", source, created, tags, url, comment };
    rslt.push(itm);
  };
  return rslt;
};

export async function updateUserFeed(userId: Dbt.userId, last_feed: Date): Promise<Rpc.FeedItem[]> {
  let usr = cache.users.get(userId)
  return await db.tx(async t => {
    let links: Dbt.Link[] = await t.any('select * from links where created > $1', [last_feed]);
    await _updateUserFeeds(t, userId, links);
    let feeds: Dbt.Feed[] = await t.any(`select * from feeds where "userId" = '${userId}' and dismissed is null order by created desc`);
    let linkItems = _convertLinksToFeeds(userId, feeds);
    let commentItems = await getCommentsFeed(userId, last_feed);
    return [...linkItems, commentItems];
  });
}

function _convertCommentsToFeeds(userId: Dbt.userId, comments: Dbt.Comment[]): Rpc.FeedItem[] {
  let rslt: Rpc.FeedItem[] = [];
  for (const c of comments) {
    let { updated, created, comment } = c;
    let cont = cache.contents.get(c.contentId);
    if (cont.userId !== userId) throw new Error("comment not for user");
    let { tags } = cont;
    let source = cache.users.get(c.userId).userName;
    let url = Utils.contentToUrl(c.contentId);
    let itm: Rpc.FeedItem = { type: "comment", source, created, tags, url, comment };
    rslt.push(itm);
  };
  return rslt;
}

export async function getCommentsFeed(userId: Dbt.userId, last_feed: Date): Promise<Rpc.FeedItem[]> {
  let usr = cache.users.get(userId)
  return await db.tx(async t => {
    let comments: Dbt.Comment[] = await tasks.getCommentsFeed(t, userId, last_feed);
    return _convertCommentsToFeeds(userId, comments);
  });
}

export async function liveUserFeed(userId: Dbt.userId, updts: cache.CacheUpdate[]): Promise<Rpc.FeedItem[]> {
  let usr = cache.users.get(userId)
  let now = new Date();
  let links = updts.filter(u => u.table === "links").map(u => u.record as Dbt.Link);
  let comments = updts.filter(u => {
    if (u.table !== "comments") return false;
    let cont: Dbt.Content = cache.contents.get(u.record.contentId);
    if (cont.userId !== userId) return false;
    return true;
  }).map(u => u.record as Dbt.Comment);
  if (links.length === 0 && comments.length === 0) return [];
  return await db.tx(async t => {
    let linkfeeds = await _updateUserFeeds(t, userId, links);
    let feeds = _convertLinksToFeeds(userId, linkfeeds);
    let cmts = _convertCommentsToFeeds(userId, comments);
    return [...feeds, ...cmts];
  });
}

export async function dismissSquawks(userId: Dbt.userId, urls: Dbt.urlString[], save: boolean): Promise<void> {
  return await db.tx(t => tasks.dismissSquawks(t, userId, urls, save));
}

export async function generateSquawks() {
  let u = await createUser();
  let i = 0;
  let uids = (await db.any(`select "userId" from users`)).map(u => u.userId);
  while (true) {
    ++i;
    for (const uid of uids) {
      let preq: Rpc.BookmarkLinkRequest = { comment: "great comment " + i, tags: [], url: "https://www.example.com/thing/" + i, signature: "", title: "awesome link " + i };
      try {
        await bookmarkAndPromoteLink(uid, preq);
      }
      catch (e) { }
      await Utils.sleep(2000);
    }
  }
}

export async function calcChargeForNextStream(viewerId: Dbt.userId, viewedLinkId: Dbt.linkId): Promise<Dbt.integer> {
  let links = cache.getChainFromLinkId(viewedLinkId);
  let l = links.length - 1;
  let link = links[l];
  let sched = link.paymentSchedule;
  let rslt = 0;
  if (sched && sched.length > 0) {
    let views: Dbt.View[] = await db.any(`select * from views where "userId" = '${viewerId}' and "linkId" = '${link.linkId}' order by "viewCount" `);
    if (views.length < sched.length) rslt = sched[views.length];
  }
  return rslt;
}
export async function getNextStreamNumber(viewerId: Dbt.userId, viewedLinkId: Dbt.linkId): Promise<Dbt.integer> {
  let links = cache.getChainFromLinkId(viewedLinkId);
  let l = links.length - 1;
  let link = links[l];
  let sched = link.paymentSchedule;
  let rslt = 0;
  if (sched && sched.length > 0) {
    let views: Dbt.View[] = await db.any(`select * from views where "userId" = '${viewerId}' and "linkId" = '${link.linkId}' `);
    rslt = views.length + 1;
  }
  return rslt;
}


