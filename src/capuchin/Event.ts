import { AppState, initState, setLink, expandedUrl, isSeen, setLoading, 
        getRedirectUrl, prepareUrl, isSynereoLink, PopupMode } from './AppState';
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
  state: AppState;
}

export interface GetState {
  eventType: "GetState";
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

export type Message = Save | Initialize | GetState | Load | ActivateTab | Render | ChangeSettings | LaunchSettingsPage 
                    | RedeemLink | GetUserLinks | DismissPromotion |Thunk ;

export function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise( resolve => {
    chrome.tabs.get(tabId, t => resolve(t));
  });
}

function updateTab(tabId: number, props: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> {
  return new Promise( resolve => {
    chrome.tabs.update(tabId, props, t => resolve(t));
  });
}

function tabsQuery(q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise( resolve => {
    chrome.tabs.query(q, a => resolve(a));
  });
}

function currentTab(): Promise<chrome.tabs.Tab> {
  return tabsQuery({ active: true, currentWindow: true }).then(a => a[0]);
}

function extractHeadersToState(st: AppState, rsp: AxiosResponse): AppState {
  let ampCredits = parseInt(rsp.headers['x-syn-credits']);
  let moniker = rsp.headers['x-syn-moniker'];
  let jwt = rsp.headers['x-syn-token'];
  if (jwt && st.jwt) throw new Error("Unexpected token received");
  if (!st.jwt && !jwt) throw new Error("Expected token but none received");
  if (!jwt) jwt = st.jwt;
  return { ...st, ampCredits, moniker, jwt };
}

export namespace AsyncHandlers {

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
      let rsp: Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      let rslt: Rpc.RecvAddContentResponse = rsp.result;
      if (rslt.prevLink) {
        chrome.runtime.sendMessage({ eventType: 'RenderMessage', msg: "Content already registered." });
        // very naughty state mutation here ... so sue me!!
        // this is to prevent an immediate render from instantaneously wiping out the above message.
        let synereoUrl = parse(rslt.prevLink);
        let linkAmplifier = rslt.linkAmplifier
        st.links.set(url, {synereoUrl, linkDepth: 0, linkAmplifier });
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
      let prv = st.ampCredits;
      st = extractHeadersToState(st, response);
      if (st.ampCredits !== prv) console.log("credits changed from : "+prv+" to "+st.ampCredits);
      let rsp : Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      let rslt: Rpc.GetRedirectResponse = rsp.result;  
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
      let rsp : Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      let rslt: Rpc.RedeemLinkResponse = rsp.result;  
      let investments = rslt.links;  
      st = {...st, investments}
      return st;
    };
  }

  export async function GetUserLinks(state: AppState): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendGetUserLinks(state);
    return (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rsp : Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      let rslt: Rpc.GetUserLinksResponse = rsp.result;  
      let investments = rslt.links; 
      let promotions = st.promotions;  
      let connectedUsers = rslt.connectedUsers;
      console.log("connected users : "+connectedUsers.length);
      if (rslt.promotions.length > 0) promotions = [...promotions, ...rslt.promotions];
      st = {...st, investments, promotions, connectedUsers};
      return st;
    };
  }

  export async function Load(state: AppState, curl_: string): Promise<(st: AppState) => AppState> {
    let curl = prepareUrl(curl_);
    if (!curl) return (st => { return { ...st, activeUrl: null }; });
    let tgt =  getRedirectUrl(state, curl)
    if (tgt) {
      let tab = await currentTab();
      console.log("redirecting to: " + tgt);
      chrome.tabs.update(tab.id, { url: tgt });
    }
    if (isSeen(state, curl)) return (st => { return { ...st, activeUrl: curl }; });
    if (isSynereoLink(parse(curl))) return GetRedirect(state,curl)
    let response = await Comms.sendLoadLink(state, curl);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rsp : Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      st = { ...st, activeUrl: curl };
      let rslt: Rpc.LoadLinkResponse = rsp.result;  
      if (rslt.found) st = setLink(st, curl, rslt.url, rslt.linkDepth, rslt.linkAmplifier);
      return st;
    };
    return thunk;
  }
  
}

export namespace Handlers {

  export async function Initialize(init: AppState, state_: AppState): Promise<AppState> {
    let state = {...init, ...state_};
    const rsp = await Comms.sendInitialize(state)
    state = extractHeadersToState(state, rsp);
    let activeTab = await currentTab()
    return { ...state, activeTab }
  }

  export async function ChangeSettings(state: AppState, settings: Rpc.ChangeSettingsRequest): Promise<AppState> {
    const response = await Comms.sendChangeSettings(state, settings);
    let rsp : Rpc.Response = response.data;
    if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
    state = extractHeadersToState(state, response);
    return state;
  }

}
