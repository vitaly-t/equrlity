import { AppState, initState, setLink, expandedUrl, isSeen, setLoading, getRedirectUrl, prepareUrl } from './AppState';

import * as localForage from "localforage";
import * as Comms from './Comms';
import { Url, parse, format } from 'url';
import { AxiosResponse } from 'axios';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import * as Utils from '../lib/utils';
import { TagSelectOption } from '../lib/tags';

export interface PromoteContent {
  eventType: "PromoteContent";
  req: Rpc.PromoteContentRequest;
}

export interface PromoteLink {
  eventType: "PromoteLink";
  amount: number;
  title: string;
  comment: string;
  tags?: string[];
}

export interface Initialize {
  eventType: "Initialize";
}

export interface Load {
  eventType: "Load";
  url: string;
}

export interface ActivateTab {
  eventType: "ActivateTab";
  tabId: number;
}

export interface Render {
  eventType: "Render";
  appState: AppState;
}

export interface ChangeSettings {
  eventType: "ChangeSettings";
  settings: Rpc.ChangeSettingsRequest;
}

export interface LaunchSettingsPage {
  eventType: "LaunchSettingsPage";
}

export interface LaunchContentsPage {
  eventType: "LaunchContentsPage";
}

export interface LaunchLinksPage {
  eventType: "LaunchLinksPage";
}

export interface LaunchUsersPage {
  eventType: "LaunchUsersPage";
}

export interface SaveContent {
  eventType: "SaveContent";
  req: Rpc.SaveContentRequest;
}

export interface RemoveContent {
  eventType: "RemoveContent";
  req: Rpc.RemoveContentRequest;
}

export interface AddContents {
  eventType: "AddContents";
  contents: Dbt.Content[];
}

export interface SaveLink {
  eventType: "SaveLink";
  req: Rpc.SaveLinkRequest;
}

export interface TransferCredits {
  eventType: "TransferCredits";
  req: Rpc.TransferCreditsRequest;
}

export interface RedeemLink {
  eventType: "RedeemLink";
  linkId: Dbt.linkId;
}

export interface GetUserLinks {
  eventType: "GetUserLinks";
}

export interface DismissPromotion {
  eventType: "DismissPromotion";
  url: Dbt.urlString;
}

export interface SaveTags {
  eventType: "SaveTags";
  tags: string[];
}

export interface Thunk {
  eventType: "Thunk";
  fn: (st: AppState) => AppState;
}

export type Message = PromoteContent | PromoteLink | Initialize | Load | ActivateTab | Render | ChangeSettings
  | LaunchSettingsPage | LaunchContentsPage | LaunchLinksPage | LaunchUsersPage
  | SaveContent | RemoveContent | AddContents
  | RedeemLink | GetUserLinks | DismissPromotion | TransferCredits
  | SaveTags | SaveLink | Thunk;

export function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, t => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
      else resolve(t)
    });
  });
}

export function loadTags(tags: string[]): TagSelectOption[] {
  let rslt: TagSelectOption[] = tags.map(t => { return { value: t, label: t }; });
  return rslt;
}

function updateTab(tabId: number, props: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> {
  return new Promise(resolve => {
    chrome.tabs.update(tabId, props, t => resolve(t));
  });
}

function tabsQuery(q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise(resolve => {
    chrome.tabs.query(q, a => resolve(a));
  });
}

async function currentTab(): Promise<chrome.tabs.Tab> {
  let a = await tabsQuery({ active: true, currentWindow: true });
  return a[0];
}

function extractHeadersToState(st: AppState, rsp: AxiosResponse): AppState {
  let credits = parseInt(rsp.headers['x-psq-credits']);
  let moniker = rsp.headers['x-psq-moniker'];

  let jwt = rsp.headers['x-psq-token'];
  if (!st.jwt && !jwt) throw new Error("Expected token but none received");
  jwt = jwt || st.jwt;
  let email = rsp.headers['x-psq-email'] || st.email;
  let authprov = rsp.headers['x-psq-authprov'] || st.authprov;

  return { ...st, credits, moniker, jwt, email, authprov };
}

type rspBody = Rpc.ResponseBody; // no idea why this is necessary :-(
function extractResult<rspBody>(response: AxiosResponse): Rpc.ResponseBody {
  let rsp: Rpc.Response = response.data;
  if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
  return rsp.result;
}

export namespace AsyncHandlers {

  export async function authenticate(userInfo: chrome.identity.UserInfo, authToken: string, publicKey: JsonWebKey): Promise<string> {
    const response = await Comms.sendAuthRequest({ userInfo, publicKey }, "Bearer " + authToken);
    let result = "";
    if (response.status === 200) {
      result = response.data.jwt;
    }
    return result;
  }

  export async function initialize(state: AppState): Promise<(st: AppState) => AppState> {
    const rsp = await Comms.sendInitialize(state)
    let activeTab = await currentTab()
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, rsp);
      let rslt: Rpc.InitializeResponse = extractResult(rsp);
      let allTags = loadTags(rslt.allTags);
      if (rslt.redirectUrl) chrome.tabs.update(activeTab.id, { url: rslt.redirectUrl });
      return { ...st, allTags, activeTab }
    }
    return thunk;
  }

  export async function promoteContent(state: AppState, req: Rpc.PromoteContentRequest): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendPromoteContent(state, req)
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.PromoteContentResponse = extractResult(response);
      if (!rslt.link) {
        //chrome.runtime.sendMessage({ eventType: 'RenderMessage', msg: "Content already registered." });
        // need to prevent an immediate render from instantaneously wiping out the above message.
      }
      else {
        let { investments } = st
        let inv: Rpc.UserLinkItem = { link: rslt.link, linkDepth: 0, viewCount: 0, promotionsCount: 0, deliveriesCount: 0 };
        investments = [inv, ...investments];
        st = { ...st, investments };
        let curl = Utils.linkToUrl(rslt.link.linkId, rslt.link.title);
        let src = Utils.contentToUrl(rslt.link.contentId);
        st = setLink(st, src, curl, 0, st.moniker);
      }
      return st;
    };
    return thunk;
  }

  export async function removeContent(state: AppState, req: Rpc.RemoveContentRequest): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendRemoveContent(state, req)
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.RemoveContentResponse = extractResult(response);
      if (!rslt.ok) {
      }
      else {
        let { contents } = st;
        let i = contents.findIndex(c => c.contentId === req.contentId);
        if (i >= 0) {
          contents = contents.slice();
          contents.splice(i, 1);
          st = { ...st, contents };
        }
      }
      return st;
    };
    return thunk;
  }

  export async function promoteLink(state: AppState, title: string, comment: string, amount: number, tags: string[] = []): Promise<(st: AppState) => AppState> {
    let curTab = await currentTab();
    if (!curTab) console.log("No current tab");
    if (curTab && prepareUrl(curTab.url) !== state.activeUrl) {
      console.log("Wrong tab");
      console.log("current : " + curTab.url)
      console.log("active : " + state.activeUrl)
      return () => state;
    }
    let src = state.activeUrl;
    let url = expandedUrl(state, src);
    let response = await Comms.sendPromoteLink(state, url, title, comment, amount, tags)
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.PromoteLinkResponse = extractResult(response);
      let { investments } = st
      let { link, linkDepth } = rslt;
      let inv: Rpc.UserLinkItem = { link, linkDepth, viewCount: 0, promotionsCount: 0, deliveriesCount: 0 };
      investments = [inv, ...investments];
      st = { ...st, investments };

      let curl = Utils.linkToUrl(rslt.link.linkId, rslt.link.title);
      return setLink(st, src, curl, linkDepth, st.moniker);
    };
    return thunk;
  }

  export async function getRedirect(state: AppState, curl: string): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendGetRedirect(state, curl);
    let tab = await currentTab();
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.GetRedirectResponse = extractResult(response);
      if (rslt.found) {
        st = setLink(st, rslt.contentUrl, curl, rslt.linkDepth, rslt.linkPromoter);
        st = { ...st, activeUrl: rslt.contentUrl };
        //console.log("redirecting to: " + rslt.contentUrl);
        chrome.tabs.update(tab.id, { url: rslt.contentUrl });
      }
      return st;
    };
  }

  export async function redeemLink(state: AppState, linkId: Dbt.linkId): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendRedeemLink(state, linkId);
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.RedeemLinkResponse = extractResult(response);
      let investments = rslt.links;
      st = { ...st, investments }
      return st;
    };
  }

  export async function getUserLinks(state: AppState): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendGetUserLinks(state);
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.GetUserLinksResponse = extractResult(response);
      let promotions = st.promotions;
      let investments = rslt.links;
      let { connectedUsers, reachableUserCount } = rslt;
      if (rslt.promotions.length > 0) promotions = [...promotions, ...rslt.promotions];
      let allTags = loadTags(rslt.allTags);
      st = { ...st, investments, promotions, connectedUsers, reachableUserCount, allTags };
      return st;
    };
  }

  export async function getUserContents(state: AppState): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendGetUserContents(state);
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.GetUserContentsResponse = extractResult(response);
      let { contents } = rslt;
      st = { ...st, contents };
      return st;
    };
  }

  export async function load(state: AppState, curl_: string): Promise<(st: AppState) => AppState> {
    let curl = prepareUrl(curl_);
    if (!curl) return (st => { return { ...st, activeUrl: null }; });
    let tgt = getRedirectUrl(state, curl)
    if (tgt) {
      let tab = await currentTab();
      console.log("redirecting to: " + tgt);
      chrome.tabs.update(tab.id, { url: tgt });
    }
    if (!isSeen(state, curl) && Utils.isPseudoQLinkURL(parse(curl))) return await getRedirect(state, curl)
    return (st => { return { ...st, activeUrl: curl }; });
    /*
    let response = await Comms.sendLoadLink(state, curl);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.LoadLinkResponse = extractResult(response);
      st = { ...st, activeUrl: curl };
      if (rslt.found) st = setLink(st, curl, rslt.url, rslt.linkDepth, rslt.linkPromoter);
      return st;
    };
    return thunk;
    */
  }

  export async function changeSettings(state: AppState, settings: Rpc.ChangeSettingsRequest): Promise<(st: AppState) => AppState> {
    const response = await Comms.sendChangeSettings(state, settings);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(state, response);
      let rslt: Rpc.ChangeSettingsResponse = extractResult(response);
      return st;
    }
    return thunk;
  }

  export async function saveContent(state: AppState, req: Rpc.SaveContentRequest): Promise<(st: AppState) => AppState> {
    const response = await Comms.sendSaveContent(state, req);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(state, response);
      let rslt: Rpc.SaveContentResponse = extractResult(response);
      if (rslt.content) {
        let { contents } = st;
        let { content } = rslt;
        let i = contents.findIndex(c => c.contentId === content.contentId);
        contents = contents.slice();
        if (i < 0) contents.unshift(content);
        else contents[i] = content;
        st = { ...st, contents };
      }
      return st;
    }
    return thunk;
  }

  export async function saveLink(state: AppState, req: Rpc.SaveLinkRequest): Promise<(st: AppState) => AppState> {
    const response = await Comms.sendSaveLink(state, req);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(state, response);
      let rslt: Rpc.SaveLinkResponse = extractResult(response);
      if (rslt.link) {
        let { investments } = st;
        let { link } = rslt;
        let i = investments.findIndex(i => i.link.linkId === link.linkId);
        let inv = { ...investments[i], link };
        investments = investments.slice();
        investments[i] = inv;
        st = { ...st, investments };
      }
      return st;
    }
    return thunk;
  }

  export async function transferCredits(state: AppState, req: Rpc.TransferCreditsRequest): Promise<(st: AppState) => AppState> {
    const response = await Comms.sendTransferCredits(state, req);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(state, response);
      let rslt: Rpc.TransferCreditsResponse = extractResult(response);
      if (!rslt.ok) {
        // do something clever...
      }
      return st;
    }
    return thunk;
  }

}
