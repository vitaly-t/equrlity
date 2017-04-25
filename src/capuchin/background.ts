import * as localForage from "localforage";

import * as OxiGen from '../gen/oxigen';

import * as Dbt from '../lib/datatypes';
import * as Crypto from '../lib/Crypto';
import * as Utils from '../lib/utils';
import { mergeTags } from '../lib/tags';

import { AppState, initState, expandedUrl, isSeen, setLoading, setWaiting, getRedirectUrl, prepareUrl, preSerialize } from './AppState';

import { Url, parse, format } from 'url';
import { Message, AsyncHandlers, getTab } from './Event';

// no touchy!!  only to be set from within handleMessage
let __state: AppState = initState();

export function currentState() {
  return __state;
}

async function createKeyPairIf(keys: string[]): Promise<void> {
  if (!Crypto.checkForKeyPair(keys)) {
    console.log("creating key pair");
    const keyPair: CryptoKeyPair = await Crypto.generateKeyPair();
    const publicKey: JsonWebKey = await Crypto.getPublicKeyJWK(keyPair);
    const privateKey: JsonWebKey = await Crypto.getPrivateKeyJWK(keyPair);
    await localForage.setItem('publicKey', publicKey);
    await localForage.setItem('privateKey', privateKey);
  }
}

function getProfile(): Promise<chrome.identity.UserInfo> {
  return new Promise(resolve => {
    chrome.identity.getProfileUserInfo(uin => resolve(uin));
  });
}

function getChromeAccessToken(): Promise<string> {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: true }, token => resolve(token))
  });
}

let tabids = new Map<string, number>();
function createSystemTab(nm: string): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ 'url': chrome.extension.getURL(nm + '.html'), 'selected': true }, t => {
      if (t.id) tabids.set(nm, t.id);
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message)
      else resolve(t);
    });
  });
}

async function launchSystemTab(nm: string) {
  if (tabids.has(nm)) {
    try {
      let tab = await getTab(tabids.get(nm));
      chrome.tabs.highlight({ windowId: tab.windowId, tabs: tab.index }, w => {
        chrome.windows.update(tab.windowId, { focused: true });
      });
    }
    catch (e) {
      tabids.delete(nm);
    }
  }
  if (!tabids.has(nm)) await createSystemTab(nm);
}

async function initialize() {
  console.log("initializing...");
  localForage.config({ name: 'pseudoq-capuchin' });
  const keys: string[] = await localForage.keys();
  const userInfo: chrome.identity.UserInfo = await getProfile();
  const chromeToken: string = await getChromeAccessToken();
  await createKeyPairIf(keys);
  const publicKey = await localForage.getItem<JsonWebKey>('publicKey');
  const privateKey = await localForage.getItem<JsonWebKey>('privateKey');
  const jwt = await AsyncHandlers.authenticate(userInfo, chromeToken, publicKey);
  if (!jwt) throw new Error("Unable to authenticate");
  await handleMessage({ eventType: "Thunk", fn: ((st: AppState) => { return { ...st, publicKey, privateKey, jwt } }) });
  handleAsyncMessage({ eventType: "Initialize" });
}

chrome.runtime.onStartup.addListener(initialize);

chrome.runtime.onInstalled.addListener(initialize);

chrome.runtime.onMessage.addListener((message, sender, cb) => {
  if (message.eventType === 'Render') {
    // unfortunately, we don't appear to be able to dispatch a message to the popup without also receiving it here :-(
    return true;
  }
  if (message.eventType == "GetState") {
    let st = preSerialize(currentState());
    cb(st);
  }
  else if (message.async) handleAsyncMessage(message);
  else handleMessage(message);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  //console.log("status: " + changeInfo.status + ", url: " + changeInfo.url);
  if (changeInfo.status == "loading" && changeInfo.url) {
    handleAsyncMessage({ eventType: "Load", url: changeInfo.url });
  }
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  handleAsyncMessage({ eventType: "ActivateTab", tabId });
});

function addHeaders(details) {
  let hdrs = details.requestHeaders;
  if (details.method === "GET") {
    hdrs.push({ name: 'x-psq-client-version', value: 'capuchin-' + Utils.capuchinVersion() });
    if (__state && __state.jwt) hdrs.push({ name: 'Authorization', value: 'Bearer ' + __state.jwt });
  }
  return { requestHeaders: hdrs };
}

chrome.webRequest.onBeforeSendHeaders.addListener(addHeaders
  , { urls: [Utils.serverUrl + "/*"] }
  , ["blocking", "requestHeaders"]);


function checkRedirect(details: chrome.webRequest.WebRequestBodyDetails) {
  if (details.method === "GET") {
    let curl = prepareUrl(details.url);
    let tgt = getRedirectUrl(__state, curl)
    if (tgt) return { redirectUrl: tgt };
  }
  return null;
}

chrome.webRequest.onBeforeRequest.addListener(checkRedirect
  , { urls: [Utils.serverUrl + "/link/*"] }
  , ["blocking"]);

export async function handleAsyncMessage(event: Message) {
  let st = currentState();
  let fn = null;
  //console.log("Async Handling :" + event.eventType);
  try {
    switch (event.eventType) {
      case "Initialize":
        fn = await AsyncHandlers.initialize(st);
        break;
      case "ChangeSettings":
        fn = await AsyncHandlers.changeSettings(st, event.settings);
        break;
      case "PromoteLink": {
        let curl = prepareUrl(st.activeUrl);
        if (!curl) return;

        // we can't do storeState from here. 
        // so instead we just lie by calling render with temporary state; (so much for source of truth!!)
        chrome.runtime.sendMessage({ eventType: 'Render', appState: preSerialize(setWaiting(st, st.activeUrl)) });
        // force a refresh with correct state in 5 seconds
        setTimeout(() => {
          //console.log("refreshing with correct state");
          chrome.runtime.sendMessage({ eventType: 'Render', appState: preSerialize(currentState()) });
        }, 5000);
        fn = await AsyncHandlers.promoteLink(st, event.title, event.comment, event.amount, event.tags);
        break;
      }
      case "PromoteContent": {
        fn = await AsyncHandlers.promoteContent(st, event.req);
        break;
      }
      case "RemoveContent": {
        fn = await AsyncHandlers.removeContent(st, event.req);
        break;
      }
      case "Load": {
        fn = await AsyncHandlers.load(st, event.url);
        break;
      }
      case "RedeemLink": {
        fn = await AsyncHandlers.redeemLink(st, event.linkId);
        break;
      }
      case "LaunchSettingsPage":
        launchSystemTab("settings");
        break;
      case "LaunchContentsPage":
        launchSystemTab("contents");
        fn = await AsyncHandlers.getUserContents(st);
        break;
      case "LaunchLinksPage":
        launchSystemTab("links");
        break;
      case "LaunchUsersPage":
        launchSystemTab("users");
        break;
      case "GetUserLinks": {
        fn = await AsyncHandlers.getUserLinks(st);
        break;
      }
      case "ActivateTab": {
        let t = await getTab(event.tabId);
        fn = await AsyncHandlers.load(st, t.url);
        break;
      }
      case "SaveContent": {
        fn = await AsyncHandlers.saveContent(st, event.req);
        break;
      }
      case "SaveLink": {
        fn = await AsyncHandlers.saveLink(st, event.req);
        break;
      }
      case "TransferCredits": {
        fn = await AsyncHandlers.transferCredits(st, event.req);
        break;
      }
    }
    if (fn) handleMessage({ eventType: "Thunk", fn }, true);
  }
  catch (e) {
    let fn = (st: AppState) => { return { ...st, lastErrorMessage: e.message }; };
    handleMessage({ eventType: "Thunk", fn }, true);
    if (e.message === "Network Error") setTimeout(() => initialize(), 15000);
  }

}

export function handleMessage(event: Message, async: boolean = false): AppState {
  function storeState(st: AppState): void {
    if (__state !== st) {
      __state = st;
      chrome.runtime.sendMessage({ eventType: 'Render', appState: preSerialize(st) });
    }
  }

  let st = currentState();
  try {
    st.lastErrorMessage = '';
    switch (event.eventType) {
      case "Thunk":
        st = event.fn(st);
        break;
      case "DismissPromotion":
        let i = st.promotions.indexOf(event.url);
        if (i >= 0) {
          let promotions = st.promotions.slice(0)
          promotions.splice(i, 1);
          st = { ...st, promotions };
        }
        break;
      case "SaveTags":
        let allTags = mergeTags(event.tags, st.allTags);
        if (allTags != st.allTags) st = { ...st, allTags };
        break;
      case "AddContents":
        let contents = [...event.contents, ...st.contents];
        st = { ...st, contents };
        break;
      default:
        throw new Error("Unknown eventType: " + event.eventType);
    }
    storeState(st);
  }
  catch (e) {
    console.log("error in handler :" + e.message);
    st.lastErrorMessage = e.message;
    if (e.message === "Network Error") setTimeout(() => initialize(), 15000);
  }
  return st;
}