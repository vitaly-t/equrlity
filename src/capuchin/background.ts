import * as localForage from "localforage";
import * as Crypto from './Crypto'

import { AppState, initState, expandedUrl, isSeen, setLoading, isWaiting, setWaiting, prepareUrl } from './AppState';
import { Url, parse, format } from 'url';
import { Message, Handlers, AsyncHandlers, getTab } from './Event';

//currently we are using a single, global, mutable model.  What could go wrong??
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

async function initialize(): Promise<AppState> {
  console.log("initializing...");
  let state = currentState();
  localForage.config({ name: 'synereo-capuchin' })
  const keys: string[] = await localForage.keys();
  await createKeyPairIf(keys);
  const publicKey = await localForage.getItem<JsonWebKey>('publicKey');
  const privateKey = await localForage.getItem<JsonWebKey>('privateKey');
  const jwt = await localForage.getItem<string>('jwt');
  if (!jwt) console.log("No JWT found");
  state = { ...state, publicKey, privateKey, jwt };
  let st = await handleMessage({ eventType: "Initialize", state });
  if (!st.lastErrorMessage) {
    if (!jwt) {
      if (!st.jwt) throw new Error("Server failed to deliver token");
      localForage.setItem<string>('jwt', st.jwt);
    }
    else if (jwt !== st.jwt) throw new Error("Unexpected update to token");
  }
  return st;
}

chrome.runtime.onStartup.addListener(initialize);

chrome.runtime.onInstalled.addListener(initialize);

chrome.runtime.onMessage.addListener((message, sender, cb) => {
  if (message.eventType === 'Render') {
    // unfortunately, we don't appear to be able to dispatch a message to the popup without also receiving it here :-(
    return true;
  }
  if (message.eventType == "GetState") cb(currentState());
  else if (message.async) handleAsyncMessage(message);
  else handleMessage(message);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status == "loading" && changeInfo.url) {
    handleAsyncMessage({ eventType: "Load", url: changeInfo.url });
  }
});

chrome.tabs.onActivated.addListener(({tabId, windowId}) => {
  handleAsyncMessage({ eventType: "ActivateTab", tabId });
});

//@@GS this is a bit hacky, but it's the best I could come up with for now.
export async function handleAsyncMessage(event: Message) {
  let st = currentState();
  let fn = null;
  switch (event.eventType) {
    case "Save": {
      let curl = prepareUrl(st.activeUrl);
      if (!curl) return;

      // we can't do storeState from here. 
      // so instead we just lie by calling render with temporary state; (so much for source of truth!!)
      chrome.runtime.sendMessage({ eventType: 'Render', appState: setWaiting(st, st.activeUrl) });
      // force a refresh with correct state in 10 seconds
      setTimeout(() => {
        //console.log("refreshing with correct state");
        chrome.runtime.sendMessage({ eventType: 'Render', appState: currentState() });
      }, 5000);
      fn = await AsyncHandlers.Save(st, event.amount);
      break;
    }
    case "Load": {
      fn = await AsyncHandlers.Load(st, event.url);
      break;
    }
    case "ActivateTab": {
      let t = await getTab(event.tabId);
      fn = await AsyncHandlers.Load(st, t.url);
      break;
    }
  }
  if (fn) handleMessage({ eventType: "Thunk", fn }, true);

}

let __handling = false;
export async function handleMessage(event: Message, async: boolean = false): Promise<AppState> {
  function storeState(st: AppState): void {
    if (__state !== st) {
      //console.log("storing state");
      __state = st;
      chrome.runtime.sendMessage({ eventType: 'Render', appState: st });
    }
  }

  let st = currentState();
  //console.log("handleMessage called for: " + event.eventType);
  try {
    if (__handling) {
      if (async) setTimeout(() => handleMessage(event, true), 1);
      else throw new Error("attempt to call handleMessage re-entrantly");
    }
    __handling = true;
    switch (event.eventType) {
      case "Thunk":
        st = event.fn(st);
        break;
      case "Initialize":
        st = await Handlers.Initialize(st, event.state);
        break;
      case "GetState":
        break;
      case "SetMode":
        st = { ...st, mode: event.mode };
        break;
      case "ChangeSettings":
        st = await Handlers.ChangeSettings(st, event.settings);
        st = { ...st, mode: "Amplify" };
        break;
    }
    st.lastErrorMessage = '';
    storeState(st);
  }
  catch (e) {
    console.log("error in handler :" + e.message);
    st.lastErrorMessage = e.message;
    if (e.message === "Network Error") setTimeout(() => initialize(), 5000);
  }
  finally {
    __handling = false;
  }
  return st
}