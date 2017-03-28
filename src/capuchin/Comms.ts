import * as UTF8 from '../lib/UTF8';
import * as Crypto from '../lib/Crypto';
import { Url, parse } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import * as Rpc from '../lib/rpc';
import { AppState } from './AppState';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes';



async function apiRequest(st: AppState) {
  let headers = { 'content-type': 'application/json', 'Accept': 'application/json' };
  if (st.jwt) headers['Authorization'] = 'Bearer ' + st.jwt;
  headers['x-psq-client-version'] = 'capuchin-' + Utils.capuchinVersion();
  //if (Utils.isDev()) headers['x-psq-moniker'] = st.moniker;
  return axios.create({
    timeout: 10000,
    headers,
    responseType: 'json',
    //transformRequest: (data) => {
    // Do whatever you want to transform the data
    //    return data;
    //},
  });
}

export async function sendAuthRequest(data: Object, authHeader: string): Promise<AxiosResponse> {
  let headers = { 'content-type': 'application/json', 'Accept': 'application/json' };
  headers['Authorization'] = authHeader;
  headers['x-psq-client-version'] = 'capuchin-' + Utils.capuchinVersion();
  let req = await axios.create({
    headers,
    responseType: 'json'
  });
  return await req.post(Utils.serverUrl + '/auth', data);
}

let id = 0;
export async function sendApiRequest(st: AppState, method: Rpc.Method, params: any): Promise<AxiosResponse> {
  let xhr = await apiRequest(st);
  id += 1;
  let data: Rpc.Request = { jsonrpc: "2.0", method, params, id };
  try {
    return await xhr.post(Utils.serverUrl + "/rpc", data);
  }
  catch (e) {
    if (!e.response) throw e;
    let msg = "Invalid response from server";
    try { msg = e.response.data.error.message; }
    catch (e) { }
    throw new Error(msg + " (" + e.response.status.toString() + ")");
  }
}

export async function sendPromoteContent(st: AppState, contentId: Dbt.contentId, linkDescription: string, amount: number): Promise<AxiosResponse> {
  const privateCryptoKey: CryptoKey = await Crypto.importPrivateKeyfromJWK(st.privateKey);
  const signature: ArrayBuffer = await Crypto.signData(privateCryptoKey, UTF8.stringToUtf8ByteArray(contentId.toString()).buffer);
  const uint8ArraySignature = new Uint8Array(signature);
  const sig = Utils.printBase64Binary(new Uint8Array(signature));
  const mime_ext = "txt";
  let req: Rpc.PromoteContentRequest = { publicKey: st.publicKey, contentId, signature: sig, linkDescription, amount };
  return await sendApiRequest(st, "promoteContent", req);
}

export async function sendPromoteLink(st: AppState, url: string, linkDescription: string, amount: number, tags: string[]): Promise<AxiosResponse> {
  const privateCryptoKey: CryptoKey = await Crypto.importPrivateKeyfromJWK(st.privateKey);
  const signature: ArrayBuffer = await Crypto.signData(privateCryptoKey, UTF8.stringToUtf8ByteArray(url).buffer);
  const uint8ArraySignature = new Uint8Array(signature);
  const sig = Utils.printBase64Binary(new Uint8Array(signature));
  const mime_ext = "txt";
  let req: Rpc.PromoteLinkRequest = { publicKey: st.publicKey, url, signature: sig, linkDescription, amount, tags };
  return await sendApiRequest(st, "promoteLink", req);
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
  return await sendApiRequest(st, "getUserLinks", {});
}

export async function sendRedeemLink(st: AppState, linkId: Dbt.linkId): Promise<AxiosResponse> {
  return await sendApiRequest(st, "redeemLink", { linkId });
}

export async function sendGetContentBody(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest(st, "getContentBody", { contentId: st.currentContent.contentId });
}

export async function sendSaveContent(st: AppState, req: Rpc.SaveContentRequest): Promise<AxiosResponse> {
  return await sendApiRequest(st, "saveContent", req);
}
