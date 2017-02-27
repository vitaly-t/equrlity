import { Url, format, parse } from 'url';
import {UserLinkItem, PostInfoItem} from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

export interface LinkInfo { synereoUrl: Url, linkDepth: number, linkAmplifier: string };

export type PopupMode = "Amplify" | "Settings";

export interface AppState {
  publicKey: JsonWebKey | null;
  privateKey: JsonWebKey | null;
  links: Map<string, LinkInfo>;
  redirects: Map<string, string>;   // keys are synereo urls - values are source urls 
  activeUrl: string | null;
  moniker: string;
  ampCredits: number;
  jwt: string;
  lastErrorMessage: string;
  investments: UserLinkItem[];
  promotions: Dbt.urlString[];
  connectedUsers: Dbt.userName[];
  reachableUserCount: Dbt.integer;
  posts: PostInfoItem[];
  currentPost: PostInfoItem;  // used to pass the target post to edit from settings page to postedit page. It is ephemeral!!
}

export function initState(): AppState {
  console.log("initState called");
  return {
    publicKey: null, privateKey: null, links: new Map<string, LinkInfo>(), redirects: new Map<string, string>(),
    activeUrl: null, moniker: 'unknown', ampCredits: 0, jwt: '', lastErrorMessage: '', 
    investments: [], promotions: [], connectedUsers: [], reachableUserCount: 0, posts: [], currentPost: null
  };
}

export function getLinked(state: AppState, curl: string): LinkInfo {
  return state.links.get(prepareUrl(curl));
}

export function setLink(state: AppState, curl_: string, syn_: string, linkDepth: number, linkAmplifier: string): AppState {
  let contentUrl = prepareUrl(curl_);
  let synereoUrl = prePrepareUrl(syn_);
  if (!synereoUrl.hash) synereoUrl.hash = '#' + contentUrl
  else synereoUrl.hash = synereoUrl.hash.replace(' ', '_');
  let info = state.links.get(contentUrl);
  if (info && format(info.synereoUrl) === format(synereoUrl)) return state;
  let links = new Map(state.links)
  links.set(contentUrl, { synereoUrl, linkDepth, linkAmplifier });
  let redir = format(synereoUrl);
  let i = redir.indexOf('#');
  redir = redir.substring(0, i);
  let redirects = new Map(state.redirects);
  redirects.set(redir, contentUrl);
  return { ...state, links, redirects };
}

// serialization occurs by sendMessages between background "page"" and popup panel
// Maps don't serialize :-(
export function preSerialize(st: AppState): any {
   let links = Object.create(null);
   st.links.forEach( (v,k) => {
     links[k] = v;
   });
   let redirects = Object.create(null);
   st.redirects.forEach( (v,k) => {
     redirects[k] = v;
   });
   return {...st, links, redirects};
}

export function postDeserialize(st: any): AppState {
   let links = new Map<string,Url>();
   for (const k in st.links) {
     links.set(k, st.links[k]);
   };
   let redirects = new Map<string,string>();
   for (const k in st.redirects) {
     redirects.set(k, st.redirects[k]);
   };
   return {...st, links, redirects};
}

export function expandedUrl(state: AppState, curl_: string = state.activeUrl): string {
  let curl = prepareUrl(curl_)
  let rslt = curl;
  if (isSeen(state, curl)) {
    let info: LinkInfo = state.links.get(curl);
    if (info) rslt = format(info.synereoUrl);
  }
  return rslt;
}

export function isSynereoLink(url: Url): boolean {
  let srch = process.env.NODE_ENV == "development" ? "localhost:8080" : "synereo";
  return (url.host.toLowerCase().indexOf(srch) >= 0)
    && (url.path.startsWith("/link/"))
}

export function getRedirectUrl(state: AppState, curl_: string): string | null {
  let curl = prepareUrl(curl_)
  return state.redirects.get(curl);
}

export function setLoading(state: AppState, curl_: string): AppState {
  let curl = prepareUrl(curl_)
  let st = state;
  if (!isSeen(st, curl)) {
    console.log("setLoading called: "+ curl_);
    let links = new Map(st.links);
    links.set(curl, null);
    st = { ...st, links };
  }
  return st;
}

export function isSeen(state: AppState, curl: string): boolean {
  return state.links.has(prepareUrl(curl));
}

export function setWaiting(state: AppState, curl_: string): AppState {
  let curl = prepareUrl(curl_)
  if (state.links.get(curl)) return state;
  let st = state;
  let links = new Map(st.links);
  links.set(curl, null);
  return { ...st, links };
}

export function isWaiting(state: AppState, curl_: string): boolean {
  let curl = prepareUrl(curl_)
  return state.links.get(curl) === null;
}

function prePrepareUrl(curl: string): Url | null {
  let url = parse(curl, false, false);  // parse query string???
  if (!url) return null;
  if (url.protocol.startsWith("chrome")) return null;
  url.query = "";
  url.search = "";
  return url
}

export function prepareUrl(curl: string): string | null {
  let url = prePrepareUrl(curl)
  if (!url) return null;
  url.hash = '';
  return format(url);
}