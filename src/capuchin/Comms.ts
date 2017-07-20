import { AxiosResponse } from 'axios';
import * as Rpc from '../lib/rpc';
import { AppState, getBookmark } from './AppState';
import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes';
import { signData, sendApiRequest } from '../lib/axiosClient';


export async function sendShareContent(st: AppState, req: Rpc.ShareContentRequest): Promise<AxiosResponse> {
  const signature = await signData(st.privateKey, req.contentId.toString());
  req = { ...req, signature };
  return await sendApiRequest("shareContent", req);
}

export async function sendRemoveContent(st: AppState, req: Rpc.RemoveContentRequest): Promise<AxiosResponse> {
  return await sendApiRequest("removeContent", req);
}

export async function sendBookmarkLink(st: AppState, url: string, title: string, comment: string, tags: string[], share?: boolean): Promise<AxiosResponse> {
  const signature = await signData(st.privateKey, url);
  let req: Rpc.BookmarkLinkRequest = { url, signature, title, comment, tags, share };
  let cont = getBookmark(st, url);
  if (cont) req = { ...req, contentId: cont.contentId };
  return await sendApiRequest("bookmarkLink", req);
}

export async function sendInitialize(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest("initialize", { publicKey: st.publicKey, last_feed: st.last_feed });
}

export async function sendUpdateFeed(st: AppState): Promise<AxiosResponse> {
  return await sendApiRequest("updateFeed", {});
}

export async function sendDismissFeeds(st: AppState, urls: Dbt.urlString[], save?: boolean): Promise<AxiosResponse> {
  save = save || false;
  return await sendApiRequest("dismissFeeds", { urls, save });
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

export async function sendTransferCredits(st: AppState, req: Rpc.TransferCreditsRequest): Promise<AxiosResponse> {
  return await sendApiRequest("transferCredits", req);
}

export function openWebSocket(st: AppState, messageHandler: (msg: any) => void, errorHandler: (err: Error) => void) {
  //console.log("opening Websocket");
  if (!st.jwt) throw new Error("missing jwt");
  let url = Utils.serverUrl.replace('http', 'ws');
  var ws = new WebSocket(url);
  let _pingTimer;
  function resetPinger() {
    if (_pingTimer) clearTimeout(_pingTimer);
    _pingTimer = setTimeout(() => {
      //console.log("pinging server");
      if (ws.readyState !== 1) {
        errorHandler(new Error("Socket not ready for ping."));
      }
      else ws.send('{"ping": true}');
    }, 10000)
  }
  ws.onopen = (event) => {
    ws.send(JSON.stringify({ jwt: st.jwt, publicKey: st.publicKey, last_feed: st.last_feed }));
  };
  ws.onmessage = (event) => {
    if (typeof event.data === 'string') {
      //console.log("string received")
      let msg;
      try {
        msg = JSON.parse(event.data);
        resetPinger();
      }
      catch (e) {
        errorHandler(new Error('Invalid JSON received on websocket: ' + event.data));
      }
      if (msg) {
        if (!msg.pong) messageHandler(msg);
        //else console.log("pong received");
      }
    }
  }
  ws.onerror = (event: ErrorEvent) => {
    ws.close();
    errorHandler(new Error("Websocket Error: " + event.message));
  }
  resetPinger();
}