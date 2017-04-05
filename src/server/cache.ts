import * as Utils from "../lib/utils";
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';
import * as uuid from '../lib/uuid';

// ahem ... cache (almost) the whole db in memory 
// probably shouldn't have exported these -- 20/20 hindsight
export const users = new Map<Dbt.userId, Dbt.User>();
export const auths = new Map<Dbt.authId, Dbt.Auth>();
export const contents = new Map<Dbt.contentId, Dbt.Content>();
export const links = new Map<Dbt.linkId, Dbt.Link>();
export const userlinks = new Map<Dbt.userId, Dbt.userId[]>();

export type CachedTable = "users" | "auths" | "contents" | "links";

export type CacheUpdate = { table: CachedTable; record: any; remove?: boolean };

let domain = ''

export function init(userRows, authRows, contentRows, linkRows, ) {
  console.log("cache init called");
  let url = parse(Utils.serverUrl);
  domain = url.host;

  users.clear();
  userRows.forEach(r => users.set(r.userId, r));

  auths.clear();
  authRows.forEach(r => auths.set(r.authProvider + ":" + r.authId, r));

  contents.clear();
  contentRows.forEach(r => contents.set(r.contentId, r));

  links.clear();
  linkRows.forEach(r => {
    links.set(r.linkId, r);
  });

  if (Utils.isDev()) {  // connect all users
    let ids = Array.from(users.keys());
    let l = ids.length;
    for (let i = 0; i < l; i++) {
      for (let j = i + 1; j < l; j++) {
        connectUsers(ids[i], ids[j]);
      }
    }
  }
  else {
    linkRows.forEach(r => {
      if (r.prevLink) {
        let prev = links.get(r.prevLink);
        connectUsers(r.userId, prev.userId);
      }
    });
  }

  // maybe later ...
  //let userlinks: Array<Dbt.UserLink> = await db.any("select * from userlinks");
}

// all functions in cache (other than init) should be synchronous.  
// async funcs that simply use the cache should go in the outer namespace

export function update(entries: CacheUpdate[]) {
  for (const { table, record, remove } of entries) {
    switch (table) {
      case "users": {
        let r: Dbt.User = record;
        if (remove) users.delete(r.userId);
        else users.set(r.userId, r);
        break;
      }
      case "auths": {
        let r: Dbt.Auth = record;
        let key = r.authProvider + ':' + r.authId;
        if (remove) auths.delete(key)
        auths.set(key, r);
        break;
      }
      case "contents": {
        let r: Dbt.Content = record;
        if (remove) contents.delete(r.contentId);
        else contents.set(r.contentId, r);
        break;
      }
      case "links": {
        let r: Dbt.Link = record;
        if (remove) links.delete(r.linkId);
        else links.set(r.linkId, r);
        break;
      }
    }
  }
}

export function connectUsers(userA: Dbt.userId, userB: Dbt.userId): void {
  if (userA === userB) return;
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

export function getContentFromLinkId(linkId: Dbt.linkId): Dbt.urlString | null {
  let link = links.get(linkId);
  if (!link) return null;
  return link.url;
}

export function linkToUrl(linkId: Dbt.linkId): Dbt.urlString {
  let desc = links.get(linkId).linkDescription;
  return Utils.linkToUrl(linkId, desc);
}

export function get_user_from_auth(prov, authId) {
  let rslt = auths[prov + ':' + authId];
  if (rslt) rslt = users[rslt];
  return rslt;
}

export function getConnectedUserNames(userId): Dbt.userName[] {
  if (!userlinks.has(userId)) return [];
  return userlinks.get(userId).map(id => users.get(id).userName);
}

export function getReachableUserIds(userId): Dbt.userId[] {
  let grph = userlinks;
  let rslt: Dbt.userId[] = [];
  if (!grph.has(userId)) return rslt;
  let seen = new Set<Dbt.userId>();
  seen.add(userId);
  let q = grph.get(userId).slice(0);
  for (let u of q) seen.add(u);
  while (q.length > 0) {
    let userId = q.shift();
    rslt.push(userId);
    seen.add(userId);
    if (grph.has(userId)) {
      for (let u of grph.get(userId)) {
        if (!seen.has(u)) q.push(u);
      }
    }
  }
  return rslt;
}

