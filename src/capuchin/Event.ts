import { AppState, initState, setLink, expandedUrl, isSeen, setLoading, 
        getRedirectUrl, prepareUrl, isSynereoLink, PopupMode } from './AppState';
import * as Comms from './Comms';
import { Url, parse, format } from 'url';
import { AxiosResponse } from 'axios';
import * as Rpc from '../lib/rpc';

export interface Save {
  eventType: "Save";
  url: string;
  amount: number;
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

export interface Thunk {
  eventType: "Thunk";
  fn: (st: AppState) => AppState;
}

export interface SetMode {
  eventType: "SetMode";
  mode: PopupMode;
}

export interface ChangeSettings {
  eventType: "ChangeSettings";
  settings: Rpc.ChangeSettingsRequest;
}

export type Message = Save | Initialize | GetState | Load | ActivateTab | Render | SetMode | ChangeSettings | Thunk 

export function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, t => resolve(t));
  });
}

function updateTab(tabId: number, props: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, props, t => resolve(t));
  });
}

function tabsQuery(q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
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
  let responses = [...st.responses, rsp];
  return { ...st, responses, ampCredits, moniker, jwt };
}

export namespace AsyncHandlers {

  export async function Save(state: AppState, amount: number): Promise<(st: AppState) => AppState> {
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
    let response = await Comms.sendAddContent(state, url, amount)
    let thunk = (st: AppState) => {
      let rsp: Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      let rslt: Rpc.RecvAddContentResponse = rsp.result;
      if (rslt.prevLink) {
        chrome.runtime.sendMessage({ eventType: 'RenderMessage', msg: "Content already registered." });
        // very naughty state mutation here ... so sue me!!
        // this is to prevent triggering an immediate render instantaneously wiping out the above message.
        st.links[url] = parse(rslt.prevLink);
        return st;
      }
      else {  //  a new link has been generated 
        st = extractHeadersToState(st, response);
        console.log("received link: " + rslt.link)
        return setLink(st, src, rslt.link);
      }
    };
    return thunk;
  }

  export async function GetRedirect(state: AppState, curl: string): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendGetRedirect(state, curl);
    let tab = await currentTab();
    return (st: AppState) => {
      let rsp : Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      let rslt: Rpc.GetRedirectResponse = rsp.result;  
      if (rslt.contentUrl) {
        st = setLink(st, rslt.contentUrl, curl);
        st = { ...st, activeUrl: rslt.contentUrl };
        console.log("redirecting to: " + rslt.contentUrl);
        chrome.tabs.update(tab.id, { url: rslt.contentUrl });
      }
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
    let response = await Comms.sendLoadLinks(state, curl);
    let thunk = (st: AppState) => {
      let rsp : Rpc.Response = response.data;
      if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
      st = { ...st, activeUrl: curl };
      let rslt: Rpc.LoadLinksResponse = rsp.result;  
      if (rslt.length > 0) {
        st = setLink(st, curl, rslt[0].url);
      }
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
