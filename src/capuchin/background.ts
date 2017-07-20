import * as localForage from "localforage";

import * as OxiGen from '../gen/oxigen';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Crypto from '../lib/Crypto';
import * as Utils from '../lib/utils';
import * as OxiDate from '../lib/oxidate';
import * as Tags from '../lib/tags';
import * as SrvrMsg from '../lib/serverMessages';

import { AppState, initState, isSeen, setLoading, setWaiting, prepareUrl, preSerialize, postDeserialize } from './AppState';

import { Url, parse, format } from 'url';
import { Message, AsyncHandlers, getTab } from './Event';
import * as Comms from './Comms';

// no touchy!!  only to be set from within handleMessage
let __state: AppState = initState();

export function currentState() {
  return __state;
}

let defaultBadgeColor;
async function __init() {
  //console.log("__init called");
  chrome.browserAction.getBadgeBackgroundColor({}, c => { defaultBadgeColor = c; });
  let st = currentState();
  if (!st.jwt) {
    //console.log("no jwt found");
    localForage.config({ name: process.env.CAPUCHIN_NAME });
    console.log("Using localForage name: " + process.env.CAPUCHIN_NAME);
    const keys: string[] = await localForage.keys();
    if (keys.indexOf('appState') >= 0) {
      let newst = await localForage.getItem<AppState>('appState');
      // allows for possible evolution (eg new properties) of appState structure in code.
      st = { ...st, ...newst, matchedTags: Object.create(null), links: Object.create(null) };

    }
    if (st.jwt) handleMessage({ eventType: "Thunk", fn: (_ => st) });
    else {
      await createKeyPairIf(keys);
      const publicKey = await localForage.getItem<JsonWebKey>('publicKey');
      const privateKey = await localForage.getItem<JsonWebKey>('privateKey');
      const userInfo: chrome.identity.UserInfo = Utils.isProduction() ? (await getProfile()) : { email: '', id: publicKey.toString() };
      const chromeToken: string = Utils.isProduction() ? await getChromeAccessToken() : '';
      const jwt = await AsyncHandlers.authenticate(userInfo, chromeToken, publicKey);
      if (!jwt) throw new Error("Unable to authenticate");
      handleMessage({ eventType: "Thunk", fn: ((st: AppState) => { return { ...st, publicKey, privateKey, jwt } }) });
    }
  }
}

let _initTimer;
async function initialize() {
  console.log("initialize called...");
  if (_initTimer) {
    clearTimeout(_initTimer);
    chrome.browserAction.setBadgeText({ text: "0" });
    chrome.browserAction.setBadgeBackgroundColor({ color: defaultBadgeColor });
    _initTimer = null;
  }
  let st = currentState();
  try {
    while (!st.jwt) {
      await __init();
      st = currentState();
    }
    Comms.openWebSocket(st, receiveServerMessages, err => {
      console.log("websocket error");
      chrome.browserAction.setBadgeText({ text: "?" });
      chrome.browserAction.setBadgeBackgroundColor({ color: "red" });
      if (!_initTimer) _initTimer = setTimeout(initialize, 5000);
    });
  }
  catch (e) {
    console.log("initialize threw : " + e.message)
    chrome.browserAction.setBadgeText({ text: "?" });
    chrome.browserAction.setBadgeBackgroundColor({ color: "red" });
    if (!_initTimer) _initTimer = setTimeout(initialize, 5000);
  }
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

let injectJs = `
var html = '';
function DOMtoString(document_root) {
  var node = document_root.firstChild;
  while (node) {
    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        html += node.outerHTML;
        break;
      case Node.TEXT_NODE:
        html += node.nodeValue;
        break;
      case Node.CDATA_SECTION_NODE:
        html += '<![CDATA[' + node.nodeValue + ']]>';
        break;
      case Node.COMMENT_NODE:
        html += '<!--' + node.nodeValue + '-->';
        break;
      case Node.DOCUMENT_TYPE_NODE:
        // (X)HTML documents are identified by public identifiers
        html += "<!DOCTYPE "
          + node.name
          + (node.publicId ? ' PUBLIC "' + node.publicId + '"' : '')
          + (!node.publicId && node.systemId ? ' SYSTEM' : '')
          + (node.systemId ? ' "' + node.systemId + '"' : '')
          + '>';
        break;
    }
    node = node.nextSibling;
  }
}

try { DOMtoString(document); }
catch(e) { html += "... ERROR:"+e.message; }
html ;

`;
//*/

chrome.runtime.onStartup.addListener(initialize);

chrome.runtime.onInstalled.addListener(initialize);

chrome.runtime.onMessage.addListener(async (message, sender, cb) => {
  if (message.eventType === 'Render') {
    // unable to dispatch a message popup without also receiving it here :-(
    return;
  }
  if (message.eventType == "GetState") {
    while (!currentState().jwt) await Utils.sleep(1000); //await initialize();
    let st = preSerialize(currentState());
    cb(st);
  }
  else if (message.async) handleAsyncMessage(message);
  else handleMessage(message);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.status === "loading") handleAsyncMessage({ eventType: "Load", url: changeInfo.url });
  else if (changeInfo.status === "complete") {
    let st = currentState();
    let url = prepareUrl(tab.url);
    if (url && st.allTags && !(url in st.links) && !(url in st.matchedTags)) {
      //console.log("injecting tag search script for url: " + url);
      //chrome.tabs.executeScript(tabId, { code: injectJs, allFrames: true }, function (rslt: any[]) {
      chrome.tabs.executeScript(tabId, { code: 'document.body.innerText', allFrames: true }, function (rslt: any[]) {
        if (chrome.runtime.lastError) {
          console.log("Tag search injection failed : " + chrome.runtime.lastError.message);
          return;
        }
        if (rslt) {
          let tags = new Set<String>();
          rslt.forEach(source => {
            if (source) {
              source = source.toLowerCase();
              st.allTags.forEach(t => {
                if (t.label.indexOf("-") > 0) {
                  let a = t.label.split("-");
                  if (a.every(l => source.indexOf(l) > 0)) tags.add(t.label);
                }
                else if (source.indexOf(t.label) >= 0) tags.add(t.label);
              })
            }
            let a = Array.from(tags);
            //if (tags.size > 0) console.log(tags.size.toString() + " tags found");
            handleMessage({
              eventType: "Thunk", fn: (st => {
                let { matchedTags } = st;
                matchedTags[url] = a;  // no need to cause a refresh???
                return st;
              })
            });
          });
        };
      });
    }
  }
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  handleAsyncMessage({ eventType: "ActivateTab", tabId });
});

function addHeaders(details) {
  let hdrs = details.requestHeaders;
  if (hdrs.findIndex(h => h.name === 'x-psq-client-version') < 0) { // first in wins!!
    hdrs.push({ name: 'x-psq-client-version', value: 'capuchin-' + Utils.capuchinVersion() });
    if (__state && __state.jwt) hdrs.push({ name: 'Authorization', value: 'Bearer ' + __state.jwt });
  }
  return { requestHeaders: hdrs };
}

chrome.webRequest.onBeforeSendHeaders.addListener(addHeaders
  , { urls: [Utils.serverUrl + "/*"] }
  , ["blocking", "requestHeaders"]);

function addResponseHeaders(details) {
  //NB: cannot be async.  
  //if (!__initialized) await initialize();
  let { responseHeaders } = details;
  if (responseHeaders.findIndex(e => e.name === 'x-psq-moniker') < 0) {
    responseHeaders.push({ name: 'x-psq-privkey', value: JSON.stringify(__state.privateKey) });
    responseHeaders.push({ name: 'x-psq-credits', value: __state.credits.toString() });
    responseHeaders.push({ name: 'x-psq-moniker', value: __state.moniker });
    responseHeaders.push({ name: 'x-psq-email', value: __state.email });
    responseHeaders.push({ name: 'x-psq-homepage', value: __state.homePage });
  }
  return { responseHeaders };
}

chrome.webRequest.onHeadersReceived.addListener(addResponseHeaders
  , { urls: [Utils.serverUrl + "/*"] }
  , ["blocking", "responseHeaders"]);


export async function handleAsyncMessage(event: Message) {
  let st = currentState();
  //while (!st.jwt) await Utils.sleep(1000); //await initialize();
  if (!st.jwt) {
    setTimeout(() => handleAsyncMessage(event), 1000);
    return;
  }
  let fn = null;
  //console.log("Async Handling :" + event.eventType);
  try {
    switch (event.eventType) {
      case "ChangeSettings": {
        fn = await AsyncHandlers.changeSettings(st, event.settings);
        break;
      }
      case "BookmarkLink": {
        fn = await AsyncHandlers.bookmarkLink(st, event);
        break;
      }
      case "SaveContent": {
        fn = await AsyncHandlers.saveContent(st, event.req);
        break;
      }
      case "ShareContent": {
        fn = await AsyncHandlers.shareContent(st, event.req);
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
      case "LaunchPage": {
        launchSystemTab(event.page);
        if (event.page === 'contents') fn = await AsyncHandlers.getUserContents(st);
        else if (event.page === 'links') fn = await AsyncHandlers.getUserLinks(st);
        break;
      }
      case "GetUserLinks": {
        fn = await AsyncHandlers.getUserLinks(st);
        break;
      }
      case "ActivateTab": {
        let t = await getTab(event.tabId);
        fn = await AsyncHandlers.load(st, t.url);
        break;
      }
      case "TransferCredits": {
        fn = await AsyncHandlers.transferCredits(st, event.req);
        break;
      }
      case "UpdateFeed": {
        fn = await AsyncHandlers.updateFeed(st);
        break;
      }
      case "DismissFeeds": {
        fn = await AsyncHandlers.dismissFeeds(st, event.feeds, event.save);
        break;
      }
      default:
        throw new Error("Invalid eventType : " + event.eventType);
    }
    if (fn) handleMessage({ eventType: "Thunk", fn });
  }
  catch (e) {
    let msg = "Error in Async handler : " + event.eventType + ", " + e.message;
    let fn = (st: AppState) => { return { ...st, lastErrorMessage: msg }; };
    handleMessage({ eventType: "Thunk", fn });
  }
}

export async function receiveServerMessages(srvmsg: SrvrMsg.ServerMessage) {
  let thunk = (st: AppState) => {
    let { credits, moniker, email, homePage, timeStamp } = srvmsg.headers;
    st = { ...st, credits, moniker, email, homePage, last_feed: timeStamp };
    let tags: Dbt.tag[] = [];
    for (const msg of srvmsg.messages) {
      switch (msg.type) {
        case "Init": {
          let rslt: Rpc.InitializeResponse = msg.message;
          let { profile_pic, last_feed, allTags } = rslt
          let _tags = Tags.mergeTags(allTags, st.allTags);
          //if (rslt.redirectUrl) chrome.tabs.update(activeTab.id, { url: rslt.redirectUrl });
          let feed = st.feed;
          rslt.feed.forEach(f => {
            let i = feed.findIndex(_ => _.id === f.id);
            if (i < 0) feed = [...feed, f];
            else feed.splice(i, 1, f);
          })
          feed.sort((a, b) => (new Date(b.created)).getTime() - (new Date(a.created).getTime()));
          chrome.browserAction.setBadgeText({ text: feed.length.toString() });
          st = { ...st, /*activeTab,*/ profile_pic, feed, last_feed, allTags: _tags };
          break;
        }
        case "Feed": {
          let f: Rpc.FeedItem = msg.message;
          let feed = st.feed;
          let i = feed.findIndex(_ => _.id === f.id);
          if (msg.remove) {
            if (i < 0) break;
            feed.splice(i, 1);
          }
          else {
            if (i < 0) feed = [...feed, f];
            else feed.splice(i, 1, f);
          }
          feed.sort((a, b) => (new Date(b.created)).getTime() - (new Date(a.created).getTime()));
          chrome.browserAction.setBadgeText({ text: feed.length.toString() });
          st = { ...st, feed };
          break;
        }
        case "Content": {
          let cont: Dbt.Content = msg.message;
          let contents = st.contents
          let i = contents.findIndex(c => c.contentId === cont.contentId);
          if (msg.remove) {
            if (i < 0) break;
            contents.splice(i, 1);
          }
          else {
            if (i < 0) contents = [...contents, cont];
            else contents.splice(i, 1, cont);
          }
          contents.sort((a, b) => (new Date(b.created)).getTime() - (new Date(a.created).getTime()));
          st = { ...st, contents };
          break;
        }
        case "Link": {
          let item: Rpc.UserLinkItem = msg.message;
          let investments = st.investments;
          let i = investments.findIndex(l => l.link.linkId === item.link.linkId);
          if (msg.remove) {
            if (i < 0) break;
            investments.splice(i, 1);
          }
          else {
            if (i < 0) investments = [...investments, item];
            else investments.splice(i, 1, item);
          }
          investments.sort((a, b) => (new Date(b.link.created)).getTime() - (new Date(a.link.created).getTime()));
          st = { ...st, investments };
          break;
        }
        case "Tag": {
          tags.push(msg.message.tag);
          break;
        }
      }
    }
    if (tags.length > 0) {
      let allTags = Tags.mergeTags(tags, st.allTags);
      st = { ...st, allTags };
    }
    return st;
  }
  handleMessage({ eventType: "Thunk", fn: thunk });
}

export function handleMessage(event: Message): AppState {
  function storeState(st: AppState): void {
    if (__state !== st) {
      __state = st;
      let appState = preSerialize({ ...st, matchedTags: null, links: null });
      localForage.setItem('appState', appState);
      chrome.runtime.sendMessage({ eventType: 'Render', appState });
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
    st = { ...st, lastErrorMessage: e.message };
    storeState(st);
  }
  return st;
}

