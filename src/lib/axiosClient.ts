import * as UTF8 from '../lib/UTF8';
import * as Crypto from '../lib/Crypto';
import { Url, parse } from 'url';
import axios, { AxiosResponse, AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes';

export type Header = { name: string, value: string };

export function clientRequest(config: AxiosRequestConfig = {}): AxiosInstance {
  return axios.create(config);
}

export function uploadRequest(): AxiosInstance {
  return clientRequest({ timeout: 600000, headers: {} });
}

function apiRequest(): AxiosInstance {
  let headers = { 'content-type': 'application/json', 'Accept': 'application/json' };
  return clientRequest({ headers, timeout: 10000, responseType: 'json' });
}

export async function signData(privateKey: JsonWebKey, data: string) {
  const privateCryptoKey: CryptoKey = await Crypto.importPrivateKeyfromJWK(privateKey);
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
export async function sendApiRequest(method: Rpc.Method, params: any): Promise<AxiosResponse> {
  let xhr = apiRequest();
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

type rspBody = Rpc.ResponseBody; // no idea why this is necessary :-(
export function extractResult<rspBody>(response: AxiosResponse): Rpc.ResponseBody {
  let rsp: Rpc.Response = response.data;
  if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
  return rsp.result;
}

