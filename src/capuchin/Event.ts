import { AppState, initState, isSeen, setLoading, prepareUrl } from './AppState';

import * as localForage from "localforage";
import * as Comms from './Comms';
import { Url, parse, format } from 'url';
import { AxiosResponse } from 'axios';

import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import * as Utils from '../lib/utils';
import { TagSelectOption } from '../lib/tags';
import { sendAuthRequest, extractResult } from '../lib/axiosClient';

export interface Initialize {
  eventType: "Initialize";
}

export interface ShareContent {
  eventType: "ShareContent";
  req: Rpc.ShareContentRequest;
}

export interface BookmarkLink {
  eventType: "BookmarkLink";
  url: Dbt.urlString;
  title: string;
  comment: string;
  tags?: string[];
  share?: boolean;
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

export interface LaunchPage {
  eventType: "LaunchPage";
  page: string;
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

export interface TransferCredits {
  eventType: "TransferCredits";
  req: Rpc.TransferCreditsRequest;
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

export interface DismissFeeds {
  eventType: "DismissFeeds";
  feeds: Rpc.FeedItem[];
  save?: boolean;
}

export interface UpdateFeed {
  eventType: "UpdateFeed";
}

export interface Thunk {
  eventType: "Thunk";
  fn: (st: AppState) => AppState;
}

export type Message = ShareContent | BookmarkLink | Initialize | Load | ActivateTab | Render | ChangeSettings
  | LaunchPage | SaveContent | RemoveContent | AddContents | DismissFeeds | UpdateFeed
  | GetUserLinks | DismissPromotion | TransferCredits | Thunk;

export function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, t => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
      else resolve(t)
    });
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
  let credits = parseInt(rsp.headers['x-psq-credits']);
  let moniker = rsp.headers['x-psq-moniker'];

  let jwt = rsp.headers['x-psq-token'];
  if (!st.jwt && !jwt) throw new Error("Expected token but none received");
  jwt = jwt || st.jwt;
  let email = rsp.headers['x-psq-email'] || st.email;
  let authprov = rsp.headers['x-psq-authprov'] || st.authprov;
  let homePage = rsp.headers['x-psq-homepage'] || st.homePage;

  return { ...st, credits, moniker, jwt, email, authprov, homePage };
}

export namespace AsyncHandlers {

  export async function authenticate(userInfo: chrome.identity.UserInfo, authToken: string, publicKey: JsonWebKey): Promise<string> {
    const response = await sendAuthRequest({ userInfo, publicKey }, "Bearer " + authToken);
    let result = "";
    if (response.status === 200) {
      result = response.data.jwt;
    }
    return result;
  }

  export async function updateFeed(state: AppState): Promise<(st: AppState) => AppState> {
    const rsp = await Comms.sendUpdateFeed(state)
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, rsp);
      let rslt: Rpc.UpdateFeedResponse = extractResult(rsp);
      let { feed } = rslt
      chrome.browserAction.setBadgeText({ text: feed.length.toString() });
      return { ...st, feed }
    }
    return thunk;
  }

  export async function dismissFeeds(state: AppState, items: Rpc.FeedItem[], save?: boolean): Promise<(st: AppState) => AppState> {
    let urls = items.filter(i => i.type === "share").map(i => i.url);
    Comms.sendDismissFeeds(state, urls, save);
    let thunk = (st: AppState) => {
      let ids = items.filter(i => i.id ? true : false).map(i => i.id);
      let feed = st.feed.filter(f => f.id && ids.indexOf(f.id) < 0);
      chrome.browserAction.setBadgeText({ text: feed.length.toString() });
      st = { ...st, feed }
      return st;
    }
    return thunk;
  }

  export async function shareContent(state: AppState, req: Rpc.ShareContentRequest): Promise<(st: AppState) => AppState> {
    let response = await Comms.sendShareContent(state, req)
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.ShareContentResponse = extractResult(response);
      if (rslt.link) {
        let { investments } = st
        let inv: Rpc.UserLinkItem = { link: rslt.link, linkDepth: 0, viewCount: 0, promotionsCount: 0, deliveriesCount: 0 };
        investments = [inv, ...investments];
        st = { ...st, investments };
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

  export async function bookmarkLink(state: AppState, req: BookmarkLink): Promise<(st: AppState) => AppState> {
    let { url, title, comment, tags, share } = req;
    let response = await Comms.sendBookmarkLink(state, url, title, comment, tags, share)
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.BookmarkLinkResponse = extractResult(response);
      let contents = st.contents;
      let i = st.contents.findIndex(c => c.contentId === rslt.content.contentId);
      if (i >= 0) {
        contents = contents.slice();
        contents.splice(i, 1);
        st = { ...st, contents };
      }
      if (rslt.link) {
        let inv: Rpc.UserLinkItem = { link: rslt.link, linkDepth: 0, promotionsCount: 0, viewCount: 0, deliveriesCount: 0 }
        let investments = [inv, ...st.investments];
        st = { ...st, investments };
      }
      let { links } = st
      // links.set(url, rslt.content)
      links[url] = rslt.content;
      return { ...st, links };
    };
    return thunk;
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
      st = { ...st, investments, promotions, connectedUsers, reachableUserCount };
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
    let activeTab = await currentTab()
    //if (state.links.has(curl)) {
    if (curl in state.links) {
      chrome.browserAction.setBadgeBackgroundColor({ color: "#2EE6D6", tabId: activeTab.id });
      return (st => { return { ...st, activeUrl: curl }; });
    }
    let response = await Comms.sendLoadLink(state, curl);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(st, response);
      let rslt: Rpc.LoadLinkResponse = extractResult(response);
      st = { ...st, activeUrl: curl };
      if (rslt.content) {
        let links = st.links;
        //links.set(curl, rslt.content)
        links[curl] = rslt.content;
        chrome.browserAction.setBadgeBackgroundColor({ color: "#2EE6D6", tabId: activeTab.id });
        //chrome.browserAction.getBadgeText({}, s => { if (!s) chrome.browserAction.setBadgeText({ text: "0", tabId: activeTab.id }); })

        st = { ...st, links };  // not really doing anything but shows correct form ...
      }
      return st;
    };
    return thunk;
  }

  export async function changeSettings(state: AppState, settings: Rpc.ChangeSettingsRequest): Promise<(st: AppState) => AppState> {
    const response = await Comms.sendChangeSettings(state, settings);
    let thunk = (st: AppState) => {
      st = extractHeadersToState(state, response);
      let rslt: Rpc.ChangeSettingsResponse = extractResult(response);
      if (rslt.ok) {
        let { homePage, email, userName, profile_pic } = settings;
        st = { ...st, homePage, email, moniker: userName, profile_pic };
      }
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
