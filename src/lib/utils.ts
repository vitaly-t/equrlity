"use strict";

import * as Dbt from './datatypes';
import { Url, parse, format } from 'url';
import { TextEncoder, TextDecoder } from 'text-encoding';

export function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function textToBuffer(s: string): Buffer {
  let a = new TextEncoder().encode(s);
  return new Buffer(a);
}

export function bufferToText(b: Buffer): string {
  let a = new Uint8Array(b);
  return new TextDecoder().decode(a);
}

export function isMember(grp) {
  let grps = localStorage.getItem('pseudoq.groups');
  return grps && grps.indexOf(grp + ',') >= 0;

}

export function isDev() {
  return process.env.NODE_ENV === 'development'
}

let _isTest = false;
export function isTest() {
  return _isTest
}

export function setTest(l: boolean) {
  return _isTest = l;
}

export function capuchinVersion() {
  return "0.9.0";
}

export const serverUrl = isDev() ? "http://localhost:8080" : "https://www.pseudoq.com";
export const chromeAuthUrl = "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=";


export function printBase64Binary(byteArray: Uint8Array): string {
  return btoa(String.fromCharCode(...byteArray));
}

export function printHexBinary(byteArray: Uint8Array): string {
  const byteArrayLength: number = byteArray.length,
    outChars: Array<string> = new Array(byteArrayLength);
  for (let i = 0; i < byteArrayLength; ++i)
    outChars[i] = ('0' + (byteArray[i] & 0xFF).toString(16)).slice(-2);
  return outChars.join('');
}

export function shuffle<T>(array): T[] {
  let index = -1;
  let length = array.length;
  let result = Array(length);
  while (++index < length) {
    let rand = Math.floor(Math.random() * (index + 1));
    result[index] = result[rand];
    result[rand] = array[index];
  }
  return result;
}

export function isPseudoQURL(url: Url): boolean {
  let srv = parse(serverUrl);
  return url.host === srv.host && url.protocol === srv.protocol;
}

export function isPseudoQLinkURL(url: Url): boolean {
  let srv = parse(serverUrl);
  return url.host === srv.host && url.protocol === srv.protocol && url.path.startsWith("/link/");
}

export function isPseudoQContentURL(url: Url): boolean {
  let srv = parse(serverUrl);
  return url.host === srv.host && url.protocol === srv.protocol && url.path.startsWith("/content/");
}

export function getContentIdFromUrl(url: Url): Dbt.linkId {
  if (!isPseudoQContentURL(url)) throw new Error("Not a PseudoQURL content url");
  let linkId = parseInt(url.path.substring(9));
  return linkId;
}

export function getLinkIdFromUrl(url: Url): Dbt.linkId {
  if (!isPseudoQLinkURL(url)) throw new Error("Not a PseudoQURL link url");
  let linkId = parseInt(url.path.substring(6));
  return linkId;
}

export function linkToUrl(linkId: Dbt.linkId, desc: Dbt.title): Dbt.urlString {
  let srv = parse(serverUrl);
  if (desc) desc = desc.replace(/ /g, '_');
  srv.pathname = "/link/" + linkId.toString()
  srv.hash = (desc ? "#" + desc : '')
  return format(srv);
}

export function contentToUrl(contentId: Dbt.contentId): Dbt.urlString {
  let srv = parse(serverUrl);
  srv.pathname = "/content/" + contentId.toString()
  return format(srv);
}

