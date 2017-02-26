import { isDev, isTest, shuffle } from "../lib/utils.js";
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';
import * as uuid from '../lib/uuid.js';

// ahem ... cache (almost) the whole db in memory 
// probably shouldn't have exported these -- 20/20 hindsight
export const users = new Map<Dbt.userId, Dbt.User>();
export const auths = new Map<Dbt.authId, Dbt.Auth>();
export const contents = new Map<Dbt.contentId, Dbt.Content>();
export const links = new Map<Dbt.linkId, Dbt.Link>();
export const userlinks = new Map<Dbt.userId, Dbt.userId[]>();
export const domain = isDev() ? 'localhost:8080' : process.env.AMPLITUDE_DOMAIN;
export function isSynereo(url: Url): boolean {
  return url.host === domain;
}

export function init(userRows, authRows, contentRows, linkRows, ) {
  console.log("cache init called");

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

  if (isDev()) {  // connect all users
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
  let desc = links.get(linkId).linkDescription;
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

//not exported
const invitations = new Map<string, Dbt.linkId>();

export function registerPossibleInvitation(ip: string, linkId: Dbt.linkId) {
  console.log("registering possible inv :"+ip)
  invitations.set(ip,linkId);
}

export function cancelPossibleInvitation(ip: string) {
  console.log("cancelling possible inv :"+ip)
  invitations.set(ip);
}

export function isPossibleInvitation(ip, linkId) {
  let id = invitations.get(ip);
  return (id && id === linkId);
}
