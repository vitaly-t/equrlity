import * as localForage from "localforage";

import * as OxiGen from '../gen/oxigen';

import * as Dbt from '../lib/datatypes';
import * as Crypto from '../lib/Crypto';
import * as Utils from '../lib/utils';
import { mergeTags } from '../lib/tags';

import { AppState, initState, isSeen, setLoading, setWaiting, prepareUrl, preSerialize } from './AppState';

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

async function __init() {
    console.log("__init called");
    let st = currentState();
    if (!st.jwt) {
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
    }
}

let __initialized = false;
async function initialize() {
    if (__initialized) return;
    console.log("initializing...");
    let st = currentState();
    __initialized = true;
    try {
        if (!st.jwt) await __init();
        await handleAsyncMessage({ eventType: "Initialize" });
    }
    catch (e) {
        await handleMessage({ eventType: "Thunk", fn: ((st: AppState) => { throw (e) }) });
        __initialized = false;
    }
}

//chrome.runtime.onStartup.addListener(initialize);

//chrome.runtime.onInstalled.addListener(initialize);

chrome.runtime.onMessage.addListener(async (message, sender, cb) => {
    if (message.eventType === 'Render') {
        // unfortunately, we don't appear to be able to dispatch a message to the popup without also receiving it here :-(
        return true;
    }
    if (message.eventType == "GetState") {
        if (!__initialized) await initialize();
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
    hdrs.push({ name: 'x-psq-client-version', value: 'capuchin-' + Utils.capuchinVersion() });
    if (__state && __state.jwt) hdrs.push({ name: 'Authorization', value: 'Bearer ' + __state.jwt });
    return { requestHeaders: hdrs };
}

chrome.webRequest.onBeforeSendHeaders.addListener(addHeaders
    , { urls: [Utils.serverUrl + "/*"] }
    , ["blocking", "requestHeaders"]);


async function addResponseHeaders(details) {
    if (!__initialized) await initialize();
    let { responseHeaders } = details;
    responseHeaders.push({ name: 'x-psq-privkey', value: JSON.stringify(__state.privateKey) });
    if (responseHeaders.findIndex(e => e.name === 'x-psq-moniker') < 0) {
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
    if (!__initialized) await initialize();
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
            case "BookmarkLink": {
                fn = await AsyncHandlers.bookmarkLink(st, event);
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
            case "LaunchPage":
                launchSystemTab(event.page);
                if (event.page === 'contents') fn = await AsyncHandlers.getUserContents(st);
                else if (event.page === 'links') fn = await AsyncHandlers.getUserLinks(st);
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
        if (fn) handleMessage({ eventType: "Thunk", fn });
    }
    catch (e) {
        let fn = (st: AppState) => { return { ...st, lastErrorMessage: e.message }; };
        handleMessage({ eventType: "Thunk", fn });
        if (e.message === "Network Error") __initialized = false;
    }

}

export function handleMessage(event: Message): AppState {
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
        st = { ...st, lastErrorMessage: e.message };
        storeState(st);
        if (e.message === "Network Error") __initialized = false;
    }
    return st;
}