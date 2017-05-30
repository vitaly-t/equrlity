import { AxiosResponse } from 'axios';
import * as Rpc from '../lib/rpc';
import { AppState, getBookmark } from './AppState';
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

export async function sendBookmarkLink(st: AppState, url: string, title: string, comment: string, tags: string[]): Promise<AxiosResponse> {
  const signature = await signData(st.privateKey, url);
  let req: Rpc.BookmarkLinkRequest = { url, signature, title, comment, tags };
  let cont = getBookmark(st, url);
  if (cont) req = { ...req, contentId: cont.contentId };
  return await sendApiRequest("bookmarkLink", req);
}

export async function sendInitialize(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest("initialize", { publicKey: st.publicKey });
}

export async function sendUpdateFeed(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest("updateFeed", {});
}

export async function sendDismissSquawks(st: AppState, urls: Dbt.urlString[], save?: boolean): Promise<AxiosResponse> {
  save = save || false;
  return await sendApiRequest("dismissSquawks", { urls, save });
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
