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
            let stmt = `ALTER TABLE "${t.name}" ADD COLUMN "${c.name}" ${c.type.sqlType} `;
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

export async function loadTags(): Promise<string[]> {
  let tagRows: Dbt.Tag[] = await db.any('select * from tags order by tag');
  let tags = tagRows.map(r => r.tag);
  return tags;
}

export async function initCache() {
  let userRows: Array<Dbt.User> = await db.any("select * from users;");
  let authRows: Array<Dbt.Auth> = await db.any("select * from auths");
  let contentRows: Array<Dbt.Content> = await db.any("select * from contents");
  let linkRows: Dbt.Link[] = await db.any('select * from links order by "linkId" ');
  let tagRows: Dbt.Tag[] = await db.any('select * from tags order by tag');
  cache.init(userRows, authRows, contentRows, linkRows, tagRows);
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

export async function upsertRecord<T>(tblnm: string, rec: Object): Promise<T> {
  return await db.task(t => tasks.upsertRecord(t, tblnm, rec));
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
  cache.users.set(userId, rslt);
}

export async function touchAuth(prov, authId) {
  let auth = await db.task(t => tasks.touchAuth(t, prov, authId));
  cache.auths.set(auth.authProvider + ":" + auth.authId, auth);
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

export async function bookmarkAndInvestInLink(userId, req: Rpc.BookmarkLinkRequest, amount: number): Promise<Rpc.PromoteContentResponse> {
  let cont: Dbt.Content;
  let pr = await db.tx(async t => {
    let { contentId, comment, tags, title, signature, url } = req;
    cont = await tasks.bookmarkLink(t, userId, contentId, title, tags, url, comment);
    contentId = cont.contentId;
    let preq: Rpc.PromoteContentRequest = { contentId, comment, tags, title, amount, signature };  //TODO: fixup signature mangling here
    return await _handlePromoteContent(t, userId, preq);
  });
  cache.contents.set(cont.contentId, cont);
  let updts: cache.CacheUpdate[] = pr[0];
  let rsp: Rpc.PromoteContentResponse = pr[1];
  cache.update(updts);
  return rsp;
}

export async function handleBookmarkLink(userId, req: Rpc.BookmarkLinkRequest): Promise<Rpc.BookmarkLinkResponse> {
  let rsp: Rpc.BookmarkLinkResponse = await db.task(t => tasks.handleBookmarkLink(t, userId, req));
  cache.contents.set(rsp.content.contentId, rsp.content);
  if (rsp.link) cache.links.set(rsp.link.linkId, rsp.link);
  return rsp;
}

async function _getUserLinks(t: ITask<any>, id: Dbt.userId): Promise<Rpc.UserLinkItem[]> {
  let a = await tasks.getLinksForUser(t, id);
  let rslt: Rpc.UserLinkItem[] = []
  for (const link of a) {
    let { linkId } = link;
    let linkDepth = cache.getLinkDepth(link);
    let viewCount = await tasks.viewCount(t, linkId);
    let promotionsCount = await tasks.promotionsCount(t, linkId);
    let deliveriesCount = await tasks.deliveriesCount(t, linkId);
    let rl: Rpc.UserLinkItem = { link, linkDepth, viewCount, promotionsCount, deliveriesCount };
    rslt.push(rl);
  };
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
    cache.contents.set(rslt.contentId, rslt);
    return rslt;
  });
}

export async function deleteContent(cont: Dbt.Content) {
  return await db.tx(t => tasks.deleteContent(t, cont))
}

export async function insertBlobContent(strm: any, content: string, mime_ext: string, contentType: Dbt.contentType, title: string, userId: Dbt.userId): Promise<Dbt.Content> {
  return await db.tx(async t => {
    let blob = await tasks.insertLargeObject(t, userId, strm);
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

export async function getCommentsForContent(contentId: Dbt.contentId): Promise<Dbt.Comment[]> {
  return await db.task(t => tasks.getCommentsForContent(t, contentId));
}

export async function saveTags(tags: Dbt.tag[]): Promise<Dbt.tag[]> {  // return list of tags added
  let newtags = tags ? tags.filter(t => !cache.tags.has(t)) : [];
  if (newtags.length > 0) {
    await db.task(t => tasks.saveTags(t, newtags));
    newtags.forEach(t => cache.tags.add(t));
  }
  return newtags;
}

export async function registerContentView(userId: Dbt.userId, contentId: Dbt.contentId, ipAddress: Dbt.ipAddress, linkId: Dbt.linkId) {
  return await db.task(t => tasks.registerContentView(t, userId, contentId, ipAddress, linkId));
}

export async function getUserFollowings(userId: Dbt.userId): Promise<Rpc.UserFollowing[]> {
  return await db.task(async t => {
    let recs: Dbt.UserFollow[] = await db.any(`select * from user_follows where "userId" = '${userId}' `);
    return recs.map(r => {
      let userName = cache.users.get(r.following).userName;
      let { subscriptions, blacklist } = r;
      let f: Rpc.UserFollowing = { userName, subscriptions, blacklist };
      return f;
    });
  });
}

export async function saveUserFollowings(userId: Dbt.userId, followings: Rpc.UserFollowing[]): Promise<void> {
  return await db.tx(t => tasks.saveUserFollowings(t, userId, followings));
}

export async function updateUserFeed(userId: Dbt.userId): Promise<Rpc.FeedItem[]> {
  let usr = cache.users.get(userId)
  let { last_feed, subscriptions } = usr;
  let now = new Date();
  return await db.tx(async t => {
    let links: Dbt.Link[] = await t.any('select * from links where created > $1', [last_feed]);
    let follows = await t.any(`select * from user_follows where "userId" = '${userId}' `);
    let feeds = links.filter(l => {
      if (follows.findIndex(f => f.following === l.userId) >= 0) return true;
      if (subscriptions && subscriptions.findIndex(t => l.tags.indexOf(t) >= 0) >= 0) return true;
      return false;
    }).map(l => {
      let f = OxiGen.emptyRec<Dbt.Feed>("feeds");
      return { ...f, userId, linkId: l.linkId };
    })
    for (const f of feeds) await tasks.insertRecord<Dbt.Feed>(t, "feeds", f);
    usr = { ...usr, last_feed: now };
    await tasks.updateRecord<Dbt.User>(t, "users", usr);

    let recs: Dbt.Feed[] = await t.any(`select * from feeds where "userId" = '${userId}' and dismissed is null order by created desc`);
    let rslt: Rpc.FeedItem[] = [];
    for (const f of recs) {
      let l: Dbt.Link = await t.one(`select * from links where "linkId" = '${f.linkId}' `);
      let source = cache.users.get(l.userId).userName;
      let { tags, created, comment } = l;
      let url = Utils.linkToUrl(l.linkId, l.title);
      let itm: Rpc.FeedItem = { source, created, tags, url, comment };
      rslt.push(itm);
    };
    return rslt;
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
        await bookmarkAndInvestInLink(uid, preq, 10);
      }
      catch (e) { }
      await Utils.sleep(2000);
    }
  }
}