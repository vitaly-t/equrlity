import * as UTF8 from '../lib/UTF8';
import * as Crypto from '../lib/Crypto';
import { Url, parse } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import * as Rpc from '../lib/rpc';
import {AppState} from './AppState';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes';

export function isDev(): boolean {
  return process.env.NODE_ENV === "development"
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
  headers['x-syn-client-version'] = 'capuchin-' +Utils.capuchinVersion();
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
  try {
     return await xhr.post(Utils.serverUrl, data );
  }
  catch (e) {
    if (!e.response) throw e;
    let msg = "Invalid response from server";
    try { msg = e.response.data.error.message; }
    catch (e) {}
    throw new Error(msg + " (" + e.response.status.toString() + ")");
  } 
}

export async function sendAddContent(st: AppState, url: string, linkDescription: string, amount: number): Promise<AxiosResponse> {
  const privateCryptoKey: CryptoKey = await Crypto.importPrivateKeyfromJWK(st.privateKey);
  const signature: ArrayBuffer = await Crypto.signData(privateCryptoKey, UTF8.stringToUtf8ByteArray(url).buffer);
  const uint8ArraySignature = new Uint8Array(signature);
  const sig = Utils.printBase64Binary(new Uint8Array(signature));
  let req: Rpc.AddContentRequest =  { publicKey: st.publicKey, content: url, signature: sig, linkDescription, amount };
  return await sendApiRequest(st, "addContent", req );
}

export async function sendInitialize(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest(st, "initialize", { publicKey: st.publicKey });
}

export async function sendLoadLink(st: AppState, url: string): Promise<AxiosResponse> {
  return await sendApiRequest(st, "loadLink", { publicKey: st.publicKey, url });
}

export async function sendGetRedirect(st: AppState, linkUrl: string): Promise<AxiosResponse> {
  return await sendApiRequest(st, "getRedirect", { linkUrl });
}

export async function sendChangeSettings(st: AppState, settings: Rpc.ChangeSettingsRequest): Promise<AxiosResponse> {
  return await sendApiRequest(st, "changeSettings", settings);
}

export async function sendGetUserLinks(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest(st, "getUserLinks", {} );
}

export async function sendRedeemLink(st: AppState, linkId: Dbt.linkId): Promise<AxiosResponse> {
  return await sendApiRequest(st, "redeemLink", {linkId} );
}
