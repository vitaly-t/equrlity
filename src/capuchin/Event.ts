import { AppState, initState, setLink, expandedUrl, isSeen, setLoading, getRedirectUrl, prepareUrl } from './AppState';
import * as Comms from './Comms';
import { Url, parse, format } from 'url';
import { AxiosResponse } from 'axios';

export interface Save {
  eventType: "Save";
  url: string;
  amount: number;
}

export interface Initialize {
  eventType: "Initialize";
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
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

export type Message = Save | Initialize | GetState | Load | ActivateTab | Render | Thunk

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
  let responses = [...st.responses, rsp];
  return { ...st, responses, ampCredits, moniker };
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
    let response = await Comms.sendAddContent(state.privateKey, state.publicKey, url, amount)
    let thunk = (st: AppState) => {
      if (response.data.error) throw new Error("Server returned error: " + response.data.error.message);
      let rslt = response.data.result;
      if (rslt.prevLink) {
        let msg = rslt.message;
        console.log("rendering message :" + msg);
        chrome.runtime.sendMessage({ eventType: 'RenderMessage', msg });
        // very naughty state mutation here ... so sue me!!
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

  export async function Load(state: AppState, curl_: string): Promise<(st: AppState) => AppState> {
    let curl = prepareUrl(curl_);
    if (!curl) return (() => state);
    let tgt = await getRedirectUrl(state, curl)
    if (tgt) {
      let tab = await currentTab();
      console.log("redirecting to: " + tgt);
      chrome.tabs.update(tab.id, { url: tgt });
    }
    if (tgt || isSeen(state, curl)) return (st => { return { ...st, activeUrl: curl }; });
    let response = await Comms.sendLoadLinks(state.publicKey, curl);
    let thunk = (st: AppState) => {
      if (response.data.error) throw new Error("Server returned error: " + response.data.error.message);
      st = { ...st, activeUrl: curl };
      let rslt: Array<any> = response.data.result;  // array of {url, amount, hitCount}
      if (rslt.length > 0) {
        st = setLink(st, curl, rslt[0].url);
      }
      return st;
    };
    return thunk;
  }

}

export namespace Handlers {

  export async function Initialize(state: AppState, publicKey: JsonWebKey, privateKey: JsonWebKey): Promise<AppState> {
    const rsp = await Comms.sendInitialize(publicKey)
    let st = extractHeadersToState(state, rsp);
    let activeTab = await currentTab()
    return { ...st, publicKey, privateKey, activeTab }
  }

}
/*
    amplify: function(tab, req) {
        let self = this;
        let dao = self.userDAO;
        let user = dao.user();

        this.clientLog(" ---- ampVideo ----");

        if (user.balance < req.ampBy) {
            this.sendMsgUI({status:"No amps"});
            this.clientLog("Insufficient amps");
            return;
        }

        //build push data
        let videoData = {
            userIP: self.config.userIP,
            Timestamp: Date.now(),
            Username: user.username,
            Value: req.ampBy,
            Version: self.getVersion()
        };
        let urlInfo = self.parseTabUrl(tab.url);
        //first get sharing link from the sniply api
        this.getShareLink(tab.url, function (shareData){
            if (shareData && shareData.href) {
                urlInfo.shareLink = shareData.href;
                videoData.shareLink = urlInfo.shareLink;
                videoData.clkURL = urlInfo.origin;
                dao.createAmplification(urlInfo.shareLink, urlInfo.refLink, urlInfo.origin, req.ampBy, self.getVersion(),
                    function(err, res){
                        //send message to page, to mark the video as amplified
                        self.sendMsgUI({status:"Amplified",videoData: videoData});
                        self.clientLog("you amplified this asset by "+ req.ampBy +" amps");
                    });
            } else {
                self.clientLog(JSON.stringify(data));
                console.log("Something wrong when creating share link. please try again later or contact us");
            }

        }, function (data){
            self.clientLog(JSON.stringify(data));
            console.log("Something wrong when creating share link. please try again later or contact us");
        });
    },


*/
