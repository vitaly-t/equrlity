import * as localForage from "localforage";
import * as Crypto from '../lib/Crypto'

import { AppState, initState, expandedUrl, isSeen, setLoading, setWaiting, prepareUrl, preSerialize } from './AppState';
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

async function initialize() {
  console.log("initializing...");
  localForage.config({ name: 'pseudoq-capuchin' });
  const keys: string[] = await localForage.keys();
  const userInfo: chrome.identity.UserInfo = await getProfile();
  const chromeToken: string = await getChromeAccessToken();
  await createKeyPairIf(keys);
  const publicKey = await localForage.getItem<JsonWebKey>('publicKey');
  const privateKey = await localForage.getItem<JsonWebKey>('privateKey');
  const jwt = await AsyncHandlers.Authenticate(userInfo, chromeToken, publicKey);
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
  if (changeInfo.status == "loading" && changeInfo.url) {
    handleAsyncMessage({ eventType: "Load", url: changeInfo.url });
  }
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  handleAsyncMessage({ eventType: "ActivateTab", tabId });
});

//@@GS this is a bit hacky, but it's the best I could come up with for now.
export async function handleAsyncMessage(event: Message) {
  let st = currentState();
  let fn = null;
  //console.log("Async Handling :" + event.eventType);
  try {
    switch (event.eventType) {
      case "Initialize":
        fn = await AsyncHandlers.Initialize(st);
        break;
      case "ChangeSettings":
        fn = await AsyncHandlers.ChangeSettings(st, event.settings);
        break;
      case "Save": {
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
        fn = await AsyncHandlers.Save(st, event.linkDescription, event.amount);
        break;
      }
      case "Load": {
        fn = await AsyncHandlers.Load(st, event.url);
        break;
      }
      case "RedeemLink": {
        fn = await AsyncHandlers.RedeemLink(st, event.linkId);
        break;
      }
      case "LaunchSettingsPage":
        chrome.tabs.create({ 'url': chrome.extension.getURL('settings.html'), 'selected': true });
        fn = await AsyncHandlers.GetUserLinks(st);
        break;
      case "GetUserLinks": {
        fn = await AsyncHandlers.GetUserLinks(st);
        break;
      }
      case "ActivateTab": {
        let t = await getTab(event.tabId);
        fn = await AsyncHandlers.Load(st, t.url);
        break;
      }
      case "SavePost": {
        fn = await AsyncHandlers.SavePost(st, event.req);
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
      case "CreatePost":
        chrome.tabs.create({ 'url': chrome.extension.getURL('post.html'), 'selected': true });
        st = { ...st, currentPost: { postId: 0, title: '', tags: [], published: null, contentUrl: null, created: null, updated: null } };
        break;
      case "LaunchPostEditPage":
        chrome.tabs.create({ 'url': chrome.extension.getURL('post.html'), 'selected': true });
        st = { ...st, currentPost: event.post };
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