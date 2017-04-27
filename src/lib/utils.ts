"use strict";

import { Url, parse, format } from 'url';
import { TextEncoder, TextDecoder } from 'text-encoding';
import * as crypto from 'crypto';

import * as Dbt from './datatypes';

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

export function getContentIdFromUrl(url: Url): Dbt.contentId {
  if (!isPseudoQContentURL(url)) throw new Error("Not a PseudoQURL content url");
  let contentId = url.path.substring(9);
  return contentId;
}

export function getLinkIdFromUrl(url: Url): Dbt.linkId {
  if (!isPseudoQLinkURL(url)) throw new Error("Not a PseudoQURL link url");
  let linkId = url.path.substring(6);
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

export function genHashId(len: number): string {
  let chars = "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
  let rnd = crypto.randomBytes(len)
  let value = new Array(len)
  let cnt = chars.length;

  for (var i = 0; i < len; i++) {
    value[i] = chars[rnd[i] % cnt]
  };

  return value.join('');
}

export function binaryIndexOf(searchElement, arr) {
  'use strict';

  var minIndex = 0;
  var maxIndex = arr.length - 1;
  var currentIndex;
  var currentElement;

  while (minIndex <= maxIndex) {
    currentIndex = (minIndex + maxIndex) / 2 | 0;
    currentElement = arr[currentIndex];

    if (currentElement < searchElement) {
      minIndex = currentIndex + 1;
    }
    else if (currentElement > searchElement) {
      maxIndex = currentIndex - 1;
    }
    else {
      return currentIndex;
    }
  }

  return -1;
}

