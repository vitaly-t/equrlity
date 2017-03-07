import {
  AppState, initState, setLink, expandedUrl, isSeen, setLoading,
  getRedirectUrl, prepareUrl, isSynereoLink, PopupMode
} from './AppState';

import * as localForage from "localforage";
import * as Comms from './Comms';
import { Url, parse, format } from 'url';
import { AxiosResponse } from 'axios';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

export interface Save {
  eventType: "Save";
  url: string;
  amount: number;
  linkDescription: string;
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

export interface LaunchPostEditPage {
  eventType: "LaunchPostEditPage";
  post: Rpc.PostInfoItem;
}

export interface SavePost {
  eventType: "SavePost";
  req: Rpc.SavePostRequest;
}

export interface CreatePost {
  eventType: "CreatePost";
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

export interface Thunk {
  eventType: "Thunk";
  fn: (st: AppState) => AppState;
}

export type Message = Save | Initialize | Load | ActivateTab | Render | ChangeSettings | LaunchSettingsPage
  | LaunchPostEditPage | SavePost | CreatePost | RedeemLink | GetUserLinks | DismissPromotion | Thunk;

export function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise(resolve => {
    chrome.tabs.get(tabId, t => resolve(t));
  });
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
  let credits = parseInt(rsp.headers['x-syn-credits']);
  let moniker = rsp.headers['x-syn-moniker'];

  let jwt = rsp.headers['x-syn-token'];
  if (!st.jwt && !jwt) throw new Error("Expected token but none received");
  jwt = jwt || st.jwt;
  let email = rsp.headers['x-syn-email'] || st.email;
  let authprov = rsp.headers['x-syn-authprov'] || st.authprov;

  return { ...st, credits, moniker, jwt, email, authprov };
}

type rspBody = Rpc.ResponseBody; // no idea why this is necessary :-(
function extractResult<rspBody>(response: AxiosResponse): Rpc.ResponseBody {
  let rsp: Rpc.Response = response.data;
  if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
  return rsp.result;
}

export namespace AsyncHandlers {

  export async function Authenticate(userInfo: chrome.identity.UserInfo, authToken: string, publicKey: JsonWebKey): Promise<string> {
    const response = await Comms.sendAuthRequest({ userInfo, publicKey }, "Bearer " + authToken);
    let result = "";
    if (response.status === 200) {
      console.log(response);
      result = response.data.jwt;
    }
    return result;
  }

  export async function Initialize(state: AppState): Promise<(st: AppState) => AppState> {
    const rsp = await Comms.sendInitialize(state)
    let activeTab = await currentTab()
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, rsp);
      let rslt: Rpc.InitializeResponse = extractResult(rsp);

      if (rslt.redirectUrl) chrome.tabs.update(activeTab.id, { url: rslt.redirectUrl });
      return { ...st, activeTab }
    }
    return thunk;
  }

  export async function Save(state: AppState, linkDescription: string, amount: number): Promise<(st: AppState) => AppState> {
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
    let response = await Comms.sendAddContent(state, url, linkDescription, amount)
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.AddContentResponse = extractResult(response);
      if (rslt.prevLink) {
        chrome.runtime.sendMessage({ eventType: 'RenderMessage', msg: "Content already registered." });
        // very naughty state mutation here ... so sue me!!
        // this is to prevent an immediate render from instantaneously wiping out the above message.
        let synereoUrl = parse(rslt.prevLink);
        let linkAmplifier = rslt.linkAmplifier
        st.links.set(url, { synereoUrl, linkDepth: 0, linkAmplifier });
        return st;
      }
      else {  //  a new link has been generated 
        console.log("received link: " + rslt.link)
        return setLink(st, src, rslt.link, rslt.linkDepth, st.moniker);
      }
    };
    return thunk;
  }

  export async function GetRedirect(state: AppState, curl: string): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendGetRedirect(state, curl);
    let tab = await currentTab();
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.GetRedirectResponse = extractResult(response);
      if (rslt.found) {
        st = setLink(st, rslt.contentUrl, curl, rslt.linkDepth, rslt.linkAmplifier);
        st = { ...st, activeUrl: rslt.contentUrl };
        console.log("redirecting to: " + rslt.contentUrl);
        chrome.tabs.update(tab.id, { url: rslt.contentUrl });
      }
      return st;
    };
  }

  export async function RedeemLink(state: AppState, linkId: Dbt.linkId): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendRedeemLink(state, linkId);
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.RedeemLinkResponse = extractResult(response);
      let investments = rslt.links;
      st = { ...st, investments }
      return st;
    };
  }

  export async function GetUserLinks(state: AppState): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendGetUserLinks(state);
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.GetUserLinksResponse = extractResult(response);
      let promotions = st.promotions;
      let investments = rslt.links;
      let { connectedUsers, reachableUserCount, posts } = rslt;
      if (rslt.promotions.length > 0) promotions = [...promotions, ...rslt.promotions];
      st = { ...st, investments, promotions, connectedUsers, reachableUserCount, posts };
      return st;
    };
  }

  export async function Load(state: AppState, curl_: string): Promise<(st: AppState) => AppState> {
    let curl = prepareUrl(curl_);
    if (!curl) return (st => { return { ...st, activeUrl: null }; });
    let tgt = getRedirectUrl(state, curl)
    if (tgt) {
      let tab = await currentTab();
      console.log("redirecting to: " + tgt);
      chrome.tabs.update(tab.id, { url: tgt });
    }
    if (isSeen(state, curl)) return (st => { return { ...st, activeUrl: curl }; });
    if (isSynereoLink(parse(curl))) return GetRedirect(state, curl)
    let response = await Comms.sendLoadLink(state, curl);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.LoadLinkResponse = extractResult(response);
      st = { ...st, activeUrl: curl };
      if (rslt.found) st = setLink(st, curl, rslt.url, rslt.linkDepth, rslt.linkAmplifier);
      return st;
    };
    return thunk;
  }

  export async function ChangeSettings(state: AppState, settings: Rpc.ChangeSettingsRequest): Promise<(st: AppState) => AppState> {
    const response = await Comms.sendChangeSettings(state, settings);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(state, response);
      let rslt: Rpc.ChangeSettingsResponse = extractResult(response);
      return st;
    }
    return thunk;
  }

  export async function SavePost(state: AppState, req: Rpc.SavePostRequest): Promise<(st: AppState) => AppState> {
    const response = await Comms.sendSavePost(state, req);
    if (req.publish) return await GetUserLinks(state);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(state, response);
      let rslt: Rpc.SavePostResponse = extractResult(response);
      let posts = rslt.posts;
      st = { ...st, posts };
      return st;
    }
    return thunk;
  }

}
