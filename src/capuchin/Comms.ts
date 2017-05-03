import * as UTF8 from '../lib/UTF8';
import * as Crypto from '../lib/Crypto';
import { Url, parse } from 'url';
import axios, { AxiosResponse, AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as Rpc from '../lib/rpc';
import { AppState } from './AppState';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes';

export type Header = { name: string, value: string };

export function clientHeaders(st): Header[] {
  let hdrs: Header[] = [{ name: 'x-psq-client-version', value: 'capuchin-' + Utils.capuchinVersion() }];
  if (st && st.jwt) hdrs.push({ name: 'Authorization', value: 'Bearer ' + st.jwt });
  return hdrs;
}

export function clientRequest(st: AppState, config: AxiosRequestConfig): AxiosInstance {
  for (const hdr of clientHeaders(st)) config.headers[hdr.name] = hdr.value;
  return axios.create(config);
}

export function uploadRequest(st: AppState): AxiosInstance {
  return clientRequest(st, { timeout: 600000, headers: {} });
}

function apiRequest(st: AppState): AxiosInstance {
  let headers = { 'content-type': 'application/json', 'Accept': 'application/json' };
  return clientRequest(st, { headers, timeout: 10000, responseType: 'json' });
}

export async function signData(st: AppState, data: string) {
  const privateCryptoKey: CryptoKey = await Crypto.importPrivateKeyfromJWK(st.privateKey);
  const signature: ArrayBuffer = await Crypto.signData(privateCryptoKey, UTF8.stringToUtf8ByteArray(data).buffer);
  const sig = Utils.printBase64Binary(new Uint8Array(signature));
  return sig;
}

export async function sendAuthRequest(data: Object, authHeader: string): Promise<AxiosResponse> {
  let headers = { 'content-type': 'application/json', 'Accept': 'application/json' };
  headers['Authorization'] = authHeader;
  headers['x-psq-client-version'] = 'capuchin-' + Utils.capuchinVersion();
  let req = axios.create({
    headers,
    responseType: 'json'
  });
  return await req.post(Utils.serverUrl + '/auth', data);
}

let id = 0;
export async function sendApiRequest(st: AppState, method: Rpc.Method, params: any): Promise<AxiosResponse> {
  let xhr = apiRequest(st);
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

export async function sendPromoteContent(st: AppState, req: Rpc.PromoteContentRequest): Promise<AxiosResponse> {
  const signature = await signData(st, req.contentId.toString());
  req = { ...req, signature };
  return await sendApiRequest(st, "promoteContent", req);
}

export async function sendRemoveContent(st: AppState, req: Rpc.RemoveContentRequest): Promise<AxiosResponse> {
  return await sendApiRequest(st, "removeContent", req);
}

export async function sendPromoteLink(st: AppState, url: string, title: string, comment: string, amount: number, tags: string[]): Promise<AxiosResponse> {
  const signature = await signData(st, url);
  let req: Rpc.PromoteLinkRequest = { url, signature, title, comment, amount, tags };
  return await sendApiRequest(st, "promoteLink", req);
}

export async function sendInitialize(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest(st, "initialize", { publicKey: st.publicKey });
}

export async function sendLoadLink(st: AppState, url: string): Promise<AxiosResponse> {
  return await sendApiRequest(st, "loadLink", { url });
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

export async function sendGetUserContents(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest(st, "getUserContents", {});
}

export async function sendRedeemLink(st: AppState, linkId: Dbt.linkId): Promise<AxiosResponse> {
  return await sendApiRequest(st, "redeemLink", { linkId });
}

export async function sendSaveContent(st: AppState, req: Rpc.SaveContentRequest): Promise<AxiosResponse> {
  return await sendApiRequest(st, "saveContent", req);
}

export async function sendSaveLink(st: AppState, req: Rpc.SaveLinkRequest): Promise<AxiosResponse> {
  return await sendApiRequest(st, "saveLink", req);
}

export async function sendTransferCredits(st: AppState, req: Rpc.TransferCreditsRequest): Promise<AxiosResponse> {
  return await sendApiRequest(st, "transferCredits", req);
}
