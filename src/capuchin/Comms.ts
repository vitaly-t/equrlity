import * as UTF8 from './codec/UTF8';
import * as Crypto from './Crypto';
import { Url, parse } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import * as Rpc from '../lib/rpc';
import {AppState} from './AppState';

export function isDev(): boolean {
  return process.env.NODE_ENV === "development"
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

/*  couldn't get this to work for reasons unfathomable
async function getCookie() {
  return new Promise( (resolve, reject) => {
    chrome.cookies.get({url: serverUrl,  name: "syn_user" }, c => {
      if (c) resolve(c);
      else {
        console.log("unable to locate cookie");
        reject("unable to find cookie");
      }
    });
  });
}
*/

async function apiRequest(st: AppState) {
  let headers = { 'content-type': 'application/json', 'Accept': 'application/json'}
  if (st.jwt) headers['Authorization'] = 'Bearer '+st.jwt;
  return axios.create({
    timeout: 10000,
    //withCredentials: true,  // not needed since cookies didn't work...
    headers,
    responseType: 'json',
    //transformRequest: (data) => {
    // Do whatever you want to transform the data
    //    return data;
    //},
  });
}


let id = 0;
export async function sendApiRequest(st: AppState, method: Rpc.Method, params: any): Promise<AxiosResponse> {
  let xhr = await apiRequest(st);
  id += 1;
  let data: Rpc.Request = { jsonrpc: "2.0", method, params, id };
  return await xhr.post(serverUrl, data );
}

export async function sendAddContent(st: AppState, url: string, amount: number): Promise<AxiosResponse> {
  const privateCryptoKey: CryptoKey = await Crypto.importPrivateKeyfromJWK(st.privateKey);
  const signature: ArrayBuffer = await Crypto.signData(privateCryptoKey, UTF8.stringToUtf8ByteArray(url).buffer);
  const uint8ArraySignature = new Uint8Array(signature);
  const sig = printBase64Binary(new Uint8Array(signature));
  let req: Rpc.AddContentRequest =  { publicKey: st.publicKey, content: url, signature: sig, amount };
  return await sendApiRequest(st, "addContent", req );
}

export async function sendInitialize(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest(st, "initialize", { publicKey: st.publicKey });
}

export async function sendLoadLinks(st: AppState, url: string): Promise<AxiosResponse> {
  return await sendApiRequest(st, "loadLinks", { publicKey: st.publicKey, url });
}

export async function sendGetRedirect(st: AppState, linkUrl: string): Promise<AxiosResponse> {
  return await sendApiRequest(st, "getRedirect", { linkUrl });
}

export async function sendChangeSettings(st: AppState, settings: Rpc.ChangeSettingsRequest): Promise<AxiosResponse> {
  return await sendApiRequest(st, "changeSettings", settings);
}
