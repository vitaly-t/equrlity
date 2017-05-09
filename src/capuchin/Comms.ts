import { AxiosResponse } from 'axios';
import * as Rpc from '../lib/rpc';
import { AppState } from './AppState';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes';
import { signData, sendApiRequest } from '../lib/axiosClient';


export async function sendPromoteContent(st: AppState, req: Rpc.PromoteContentRequest): Promise<AxiosResponse> {
  const signature = await signData(st.privateKey, req.contentId.toString());
  req = { ...req, signature };
  return await sendApiRequest("promoteContent", req);
}

export async function sendRemoveContent(st: AppState, req: Rpc.RemoveContentRequest): Promise<AxiosResponse> {
  return await sendApiRequest("removeContent", req);
}

export async function sendPromoteLink(st: AppState, url: string, title: string, comment: string, amount: number, tags: string[]): Promise<AxiosResponse> {
  const signature = await signData(st.privateKey, url);
  let req: Rpc.PromoteLinkRequest = { url, signature, title, comment, amount, tags };
  return await sendApiRequest("promoteLink", req);
}

export async function sendInitialize(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest("initialize", { publicKey: st.publicKey });
}

export async function sendLoadLink(st: AppState, url: string): Promise<AxiosResponse> {
  return await sendApiRequest("loadLink", { url });
}

export async function sendGetRedirect(st: AppState, linkUrl: string): Promise<AxiosResponse> {
  return await sendApiRequest("getRedirect", { linkUrl });
}

export async function sendChangeSettings(st: AppState, settings: Rpc.ChangeSettingsRequest): Promise<AxiosResponse> {
  return await sendApiRequest("changeSettings", settings);
}

export async function sendGetUserLinks(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest("getUserLinks", {});
}

export async function sendGetUserContents(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest("getUserContents", {});
}

export async function sendRedeemLink(st: AppState, linkId: Dbt.linkId): Promise<AxiosResponse> {
  return await sendApiRequest("redeemLink", { linkId });
}

export async function sendSaveContent(st: AppState, req: Rpc.SaveContentRequest): Promise<AxiosResponse> {
  return await sendApiRequest("saveContent", req);
}

export async function sendSaveLink(st: AppState, req: Rpc.SaveLinkRequest): Promise<AxiosResponse> {
  return await sendApiRequest("saveLink", req);
}

export async function sendTransferCredits(st: AppState, req: Rpc.TransferCreditsRequest): Promise<AxiosResponse> {
  return await sendApiRequest("transferCredits", req);
}
