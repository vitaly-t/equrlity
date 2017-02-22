"use strict";

export function isMember(grp) {
	let grps = localStorage.getItem('pseudoq.groups');
	return grps && grps.indexOf(grp+',') >= 0;

}

export function isDev() {
    return process.env.NODE_ENV === 'development'
}

export function capuchinVersion() {
	return "0.8.0";
}

export const serverUrl = isDev() ? "http://localhost:8080/rpc" 
                          : "https://synereo-amplitude.herokuapp.com/rpc";

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

export function shuffle(array) {
  var rand, index = -1,
    length = array.length,
    result = Array(length);
  while (++index < length) {
    rand = Math.floor(Math.random() * (index + 1));
    result[index] = result[rand];
    result[rand] = array[index];
  }
  return result;
}
