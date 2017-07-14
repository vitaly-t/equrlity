import * as OxiGen from '../gen/oxigen';

import * as Utils from "../lib/utils";
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes'
import * as uuid from '../lib/uuid';
import { liveUserFeed } from './pgsql';

// ahem ... cache (almost) the whole db in memory 

export interface IReadonlyMap<K, V> { get: (key: K) => V, has: (key: K) => boolean }

const _users = new Map<Dbt.userId, Dbt.User>();
const _contents = new Map<Dbt.contentId, Dbt.Content>();
const _links = new Map<Dbt.linkId, Dbt.Link>();
const _comments = new Map<Dbt.commentId, Dbt.Comment>();
const _userlinks = new Map<Dbt.userId, Dbt.userId[]>();
const _followers = new Map<Dbt.userId, Set<Dbt.userId>>();

export const users: IReadonlyMap<Dbt.userId, Dbt.User> = _users;
export const contents: IReadonlyMap<Dbt.contentId, Dbt.Content> = _contents;
export const links: IReadonlyMap<Dbt.linkId, Dbt.Link> = _links;
export const comments: IReadonlyMap<Dbt.commentId, Dbt.Comment> = _comments;
export const userlinks: IReadonlyMap<Dbt.userId, Dbt.userId[]> = _userlinks;
export const followers: IReadonlyMap<Dbt.userId, Set<Dbt.userId>> = _followers;

export type CachedTable = "users" | "contents" | "links" | "comments";

export function rowCount(tbl: CachedTable) {
  switch (tbl) {
    case "users": return _users.size;
    case "contents": return _contents.size;
    case "links": return _links.size;
    case "comments": return _comments.size;
  }
  throw new Error("Invalid table for cache: " + tbl);
}

export type CacheUpdate = { table: CachedTable; record: any; remove?: boolean };

type SendUpdates = (updt: CacheUpdate[]) => void;
type UpdateFilter = (updt: CacheUpdate) => boolean;
export type Subscription = { filter: UpdateFilter, send: SendUpdates };

const subscriptions: Subscription[] = [];

export function subscribe(sub: Subscription) {
  subscriptions.push(sub);
}

export function unSubscribe(sub: Subscription) {
  let i = subscriptions.indexOf(sub);
  if (i >= 0) subscriptions.splice(i, 1);
}

function publish(updts: CacheUpdate[]) {
  for (const sub of subscriptions) {
    let us = updts.filter(sub.filter);
    if (us.length > 0) sub.send(us);
  }
}

export function setContent(v: Dbt.Content) {
  _contents.set(v.contentId, v);
  publish([{ table: "contents", record: v }]);
}

export function deleteContent(v: Dbt.Content) {
  _contents.delete(v.contentId);
  publish([{ table: "contents", record: v, remove: true }]);
}

export function setComment(v: Dbt.Comment) {
  _comments.set(v.commentId, v);
  publish([{ table: "comments", record: v }]);
}

export function deleteComment(v: Dbt.Comment) {
  _comments.delete(v.commentId);
  publish([{ table: "comments", record: v, remove: true }]);
}

export function deleteUser(v: Dbt.User) {
  if (v.following) v.following.forEach(id => _followers.get(id).delete(v.userId));
  _users.delete(v.userId);
  publish([{ table: "users", record: v, remove: true }]);
}

export function setUser(v: Dbt.User) {
  if (_users.has(v.userId)) {
    let olds = _users.get(v.userId).following;
    if (olds) olds.forEach(id => _followers.get(id).delete(v.userId))
  }
  _users.set(v.userId, v);
  if (!_followers.has(v.userId)) _followers.set(v.userId, new Set<Dbt.userId>());
  if (v.following) v.following.forEach(id => _followers.get(id).add(v.userId));
  publish([{ table: "users", record: v }]);
}

export function setLink(v: Dbt.Link) {
  _links.set(v.linkId, v);
  publish([{ table: "links", record: v }]);
}

export function deleteLink(v: Dbt.Link) {
  _links.delete(v.linkId);
  publish([{ table: "links", record: v, remove: true }]);
}

export function allUserNames(userId: Dbt.userId): Dbt.userName[] {
  return Array.from(_users.values()).filter(u => u.userId !== userId).map(u => u.userName);
}

let domain = '';

export function init(userRows: Dbt.User[], contentRows: Dbt.Content[], linkRows: Dbt.Link[], commentRows: Dbt.Comment[]) {
  console.log("cache init called");
  let url = parse(Utils.serverUrl);
  domain = url.host;

  _users.clear();
  userRows.forEach(r => {
    _users.set(r.userId, r);
    _followers.set(r.userId, new Set<Dbt.userId>());
  });
  userRows.forEach(r => {
    if (r.following) r.following.forEach(id => _followers.get(id).add(r.userId));
  });

  _contents.clear();
  contentRows.forEach(r => _contents.set(r.contentId, r));

  _comments.clear();
  commentRows.forEach(r => _comments.set(r.commentId, r));

  _links.clear();
  linkRows.forEach(r => _links.set(r.linkId, r));

  if (Utils.isDev()) {  // connect all users
    let ids = Array.from(_users.keys());
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
        let prev = _links.get(r.prevLink);
        connectUsers(r.userId, prev.userId);
      }
    });
  }

  // maybe later ...
  //let userlinks: Array<Dbt.UserLink> = await db.any("select * from userlinks");
}

// all functions in cache (other than init) should be synchronous.  

export async function update(entries: CacheUpdate[]) {
  for (const { table, record, remove } of entries) {
    switch (table) {
      case "users": {
        let r: Dbt.User = record;
        if (remove) _users.delete(r.userId);
        else _users.set(r.userId, r);
        break;
      }
      case "contents": {
        let r: Dbt.Content = record;
        if (remove) _contents.delete(r.contentId);
        else _contents.set(r.contentId, r);
        break;
      }
      case "links": {
        let r: Dbt.Link = record;
        if (remove) _links.delete(r.linkId);
        else _links.set(r.linkId, r);
        break;
      }
      case "comments": {
        let r: Dbt.Comment = record;
        if (remove) _comments.delete(r.commentId);
        else _comments.set(r.commentId, r);
        break;
      }
    }
  }
  publish(entries);
}

export function connectUsers(userA: Dbt.userId, userB: Dbt.userId): void {
  if (userA === userB) return;
  if (!_userlinks.has(userA)) _userlinks.set(userA, [userB])
  else {
    let a = _userlinks.get(userA);
    if (a.indexOf(userB) < 0) a.push(userB);
  }
  if (!_userlinks.has(userB)) _userlinks.set(userB, [userA])
  else {
    let a = _userlinks.get(userB);
    if (a.indexOf(userA) < 0) a.push(userA);
  }
}

export function getChainFromLinkId(linkId: Dbt.linkId): Array<Dbt.Link> {
  let link = _links.get(linkId);
  let rslt = [link]
  while (link.prevLink) {
    link = _links.get(link.prevLink);
    rslt.push(link);
  }
  return rslt;
}

export function getLinkDepth(link: Dbt.Link): Dbt.integer {
  let rslt = 0
  while (link.prevLink) {
    ++rslt;
    link = _links.get(link.prevLink);
  }
  return rslt;
}

export function getContentFromLinkId(linkId: Dbt.linkId): Dbt.urlString | null {
  let link = _links.get(linkId);
  let cont = _contents.get(link.contentId);
  if (cont.contentType === "bookmark") return cont.title;
  return Utils.contentToUrl(cont.contentId);
}

export function linkToUrl(linkId: Dbt.linkId): Dbt.urlString {
  let contentId = _links.get(linkId).contentId;
  let desc = _contents.get(contentId).title;
  return Utils.linkToUrl(linkId, desc);
}

export function getUserByName(userName: Dbt.userName): Dbt.User {
  for (let u of _users.values()) if (u.userName === userName) return u;
  return null;
}

export function getConnectedUserNames(userId): Dbt.userName[] {
  if (!_userlinks.has(userId)) return [];
  return _userlinks.get(userId).map(id => _users.get(id).userName);
}

export function getReachableUserIds(userId): Dbt.userId[] {
  let grph = _userlinks;
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

export function getUserFollowings(userId: Dbt.userId): Dbt.userName[] {
  let user = _users.get(userId);
  return user.following.map(id => _users.get(id).userName);
}


