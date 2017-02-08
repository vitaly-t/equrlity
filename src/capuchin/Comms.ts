import * as UTF8 from './codec/UTF8';
import * as Crypto from './Crypto';
import { Url, parse } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';

export function isDev(): boolean {
  // return process.env.NODE_ENV === "development"
  return true;
}

const serverUrl = isDev() ? "http://localhost:8080/rpc" : "http://168.62.214.211:6146/rpc";

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

function apiRequest() {
  return axios.create({
    timeout: 10000,
    headers: { 'content-type': 'application/json', 'Accept': 'application/json' },
    responseType: 'json',
    //transformRequest: (data) => {
    // Do whatever you want to transform the data
    //    return data;
    //},
  });
}

type RpcMethod = "addContent" | "loadLinks" |"initialize";
export interface RpcResponse {
  id: number;
  error: any;
  result: any;
}


let id = 0;
export async function sendApiRequest(method: RpcMethod, params: any) {
  let xhr = apiRequest();
  id += 1;
  let data = { jsonrpc: "2.0", method, params, id };
  return await xhr.post(serverUrl, data );
}

export async function sendAddContent(priv: JsonWebKey, pub: JsonWebKey, url: string, amount: number): Promise<any> {
  const privateCryptoKey: CryptoKey = await Crypto.importPrivateKeyfromJWK(priv);
  const signature: ArrayBuffer = await Crypto.signData(privateCryptoKey, UTF8.stringToUtf8ByteArray(url).buffer);
  const uint8ArraySignature = new Uint8Array(signature);
  const sig = printBase64Binary(new Uint8Array(signature));
  return await sendApiRequest("addContent", { publicKey: pub, content: url, signature: sig, amount });
}

export async function sendInitialize(pub: JsonWebKey): Promise<any> {
  return await sendApiRequest("initialize", { publicKey: pub });
}

export async function sendLoadLinks(publicKey: JsonWebKey, url: string): Promise<any> {
  return await sendApiRequest("loadLinks", { publicKey, url });
}
