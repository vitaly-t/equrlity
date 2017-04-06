"use strict";

import { Url, parse, format } from 'url';
import { IMain, IDatabase, ITask } from 'pg-promise';
import * as pgPromise from 'pg-promise';

import * as Utils from "../lib/utils";
import * as Rpc from '../lib/rpc';
import * as OxiDate from '../lib/oxidate';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';
import * as uuid from '../lib/uuid.js';
import { genInsertStatement } from "../lib/oxigen";

import * as cache from './cache';
import * as tasks from './pgtasks';

export let connectUrl: string = Utils.isTest() ? process.env.DEV_PSEUDOQURL_TEST_URL : Utils.isDev() ? process.env.DEV_PSEUDOQURL_URL : process.env.PSEUDOQURL_URL;
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
  return await db.task(t => tasks.updateRecord(t, tblnm, rec));
}

export async function insertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  return await db.task(t => tasks.insertRecord(t, tblnm, rec));
}

export async function upsertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  return await db.task(t => tasks.upsertRecord(t, tblnm, rec));
}

export async function retrieveRecord<T>(tblnm: string, pk: Object): Promise<T> {
  return await db.task(t => tasks.retrieveRecord(t, tblnm, pk));
}

export async function countRecordsInTable(tblnm: string): Promise<number> {
  return await db.task(t => tasks.countRecordsInTable(t, tblnm));
}

export async function retrieveContentByTitle(title: string, contentType: Dbt.contentType): Promise<Dbt.Content> {
  return await db.task(t => tasks.retrieveContentByTitle(t, title, contentType));
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
  cache.users.set(userId, rslt);
}

export async function touchAuth(prov, authId) {
  let auth = await db.task(t => tasks.touchAuth(t, prov, authId));
  cache.auths.set(auth.authProvider + ":" + auth.authId, auth);
}

export async function getRootLinksForContentId(id: Dbt.contentId): Promise<Dbt.Link[]> {
  return await db.task(t => tasks.getRootLinksForContentId(t, id));
}

export async function getLinksForContentId(id: Dbt.contentId): Promise<Dbt.Link | null> {
  return await db.task(t => tasks.getLinksForContentId(t, id));
}

export async function findRootLinkForContentId(id: Dbt.contentId): Promise<Dbt.Link | null> {
  return await db.task(t => tasks.getLinksForContentId(t, id));
}

export async function getRootLinksForUrl(url: Dbt.urlString): Promise<Dbt.Link[]> {
  return await db.task(t => tasks.getRootLinksForUrl(t, url));
}

export async function getLinksForUrl(url: Dbt.urlString): Promise<Dbt.Link | null> {
  return await db.task(t => tasks.getLinksForUrl(t, url));
}

export async function findRootLinkForUrl(url: Dbt.urlString): Promise<Dbt.Link | null> {
  return await db.task(t => tasks.findRootLinkForUrl(t, url));
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

async function _getPromotionLinks(t: ITask<any>, link: Dbt.Link, maxLen: Dbt.integer = cache.users.size): Promise<Dbt.userId[]> {
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

export async function getPromotionLinks(link: Dbt.Link, maxLen: Dbt.integer = cache.users.size): Promise<Dbt.userId[]> {
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

export async function investInLink(link: Dbt.Link, adj: Dbt.integer): Promise<void> {
  cache.update(await db.task(t => tasks.investInLink(t, link, adj)));
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

export async function payForView(viewerId: Dbt.userId, viewedLinkId: Dbt.linkId): Promise<void> {
  let links = cache.getChainFromLinkId(viewedLinkId);
  let viewedLink = links[0];
  cache.connectUsers(viewerId, viewedLink.userId);
  cache.update(await db.tx(t => tasks.payForView(t, links, viewerId, viewedLinkId)));
}

export async function createUser(email?: string): Promise<Dbt.User> {
  let user = await db.task(t => tasks.createUser(t, email));
  console.log("user created : " + user.userName);
  if (cache.users.has(user.userId)) {
    throw new Error("cache is cactus");
  }
  cache.users.set(user.userId, user);
  return user;
};

async function _handlePromoteContent(t: ITask<any>, userId, { publicKey, contentId, signature, amount }): Promise<[cache.CacheUpdate[], Rpc.PromoteContentResponse]> {
  let usr = await tasks.retrieveRecord<Dbt.User>(t, "users", { userId });
  if (amount > usr.credits) throw new Error("Negative balances not allowed");
  let cont = await tasks.retrieveRecord<Dbt.Content>(t, "contents", { contentId });
  if (userId !== cont.userId) throw new Error("Content owned by different user");
  let links = await tasks.getRootLinksForContentId(t, contentId);
  if (links.length > 0) throw new Error("Content already promoted");
  let url = Utils.contentToUrl(contentId);
  let updts = await tasks.promoteLink(t, userId, url, cont.title, amount);
  let link = updts.find(e => e.table === "links" as cache.CachedTable).record;
  await _promoteLink(t, link, amount);
  let rsp: Rpc.PromoteContentResponse = { url };
  return [updts, rsp];
}

export async function handlePromoteContent(userId, { publicKey, contentId, signature, amount }): Promise<Rpc.PromoteContentResponse> {
  let pr = await db.tx(t => _handlePromoteContent(t, userId, { publicKey, contentId, signature, amount }));
  let updts: cache.CacheUpdate[] = pr[0];
  let rsp: Rpc.PromoteContentResponse = pr[1];
  cache.update(updts);
  return rsp;
}

async function _handlePromoteLink(t: ITask<any>, userId, { publicKey, url, signature, linkDescription, amount }): Promise<[cache.CacheUpdate[], Rpc.PromoteLinkResponse]> {
  let ourl = parse(url);
  let linkId = 0;
  let link = null;
  let linkDepth = 0;
  let rslt: cache.CacheUpdate[] = [];
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
      rslt = await tasks.promoteLink(t, userId, url, linkDescription, amount);
      linkDepth += 1;
    }
  }
  else {
    rslt = await tasks.promoteLink(t, userId, url, linkDescription, amount);
  }
  link = rslt.find(e => e.table === "links" as cache.CachedTable).record;
  await _promoteLink(t, link, amount);
  let linkPromoter = cache.users.get(userId).userName;
  return [rslt, { link: Utils.linkToUrl(link.linkId, linkDescription), linkDepth, linkPromoter }];
}

export async function handlePromoteLink(userId, { publicKey, url, signature, linkDescription, amount }): Promise<Rpc.PromoteLinkResponse> {
  let pr = await db.tx(t => _handlePromoteLink(t, userId, { publicKey, url, signature, linkDescription, amount }));
  let updts: cache.CacheUpdate[] = pr[0];
  let rsp: Rpc.PromoteLinkResponse = pr[1];
  cache.update(updts);
  return rsp;
}

async function _getUserLinks(t: ITask<any>, id: Dbt.userId): Promise<Rpc.UserLinkItem[]> {
  let a = await tasks.getLinksForUser(t, id);
  let rslt: Rpc.UserLinkItem[] = []
  for (const l of a) {
    let linkId = l.linkId;
    let contentUrl = l.url
    let linkDepth = cache.getLinkDepth(l);
    let viewCount = await tasks.viewCount(t, linkId);
    let promotionsCount = await tasks.promotionsCount(t, linkId);
    let deliveriesCount = await tasks.deliveriesCount(t, linkId);
    let amount = l.amount;
    let rl: Rpc.UserLinkItem = { linkId, contentUrl, linkDepth, viewCount, promotionsCount, deliveriesCount, amount };
    rslt.push(rl);
  };
  return rslt;
}

export async function getUserLinks(id: Dbt.userId): Promise<Rpc.UserLinkItem[]> {
  return await db.task(t => _getUserLinks(t, id));
}

export async function getUserContents(id: Dbt.userId): Promise<Rpc.ContentInfoItem[]> {
  return await db.task(t => tasks.getUserContents(t, id));
}

export async function getContentBody(id: Dbt.contentId): Promise<Buffer> {
  return await db.task(t => tasks.getContentBody(t, id));
}

export async function saveContent(req: Rpc.SaveContentRequest): Promise<Dbt.Content> {
  return await db.task(t => tasks.saveContent(t, req));
}

export async function addContent(req: Rpc.SaveContentRequest, userId: Dbt.userId): Promise<Dbt.Content> {
  return await db.task(t => tasks.addContent(t, req, userId));
}

export async function registerInvitation(ipAddress: string, linkId: Dbt.linkId): Promise<Dbt.Invitation> {
  return await db.tx(t => tasks.registerInvitation(t, ipAddress, linkId));
}

export async function insertContent(content: string, mime_ext: string, contentType: Dbt.contentType, title: string, userId: Dbt.userId): Promise<Dbt.Content> {
  let cont = OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("contents"));
  title = title.replace(/_/g, " ");
  cont = { ...cont, mime_ext, content, contentType, title, userId };
  let rslt = await insertRecord<Dbt.Content>("contents", cont);
  return rslt;
}

export async function insertBlobContent(blob: Buffer, content: string, mime_ext: string, contentType: Dbt.contentType, title: string, userId: Dbt.userId): Promise<Dbt.Content> {
  let rblob = OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("blobs"));
  let b = await insertRecord<Dbt.Blob>("blobs", { blob });
  let cont = OxiGen.emptyRec<Dbt.Content>(oxb.tables.get("contents"));
  title = title.replace(/_/g, " ");
  cont = { ...cont, mime_ext, content, contentType, title, userId, blobId: b.blobId };
  let rslt = await insertRecord<Dbt.Content>("contents", cont);
  return rslt;
}

export async function retrieveBlobContent(contentId: Dbt.contentId): Promise<string> {
  let cont = await retrieveRecord<Dbt.Content>("contents", { contentId });
  return cont.content;
}
