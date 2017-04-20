import { Url, format, parse } from 'url';
import { UserLinkItem } from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import *as Utils from '../lib/utils';
import { TagSelectOption } from '../lib/tags';

export interface LinkInfo { pseudoqUrl: Url, linkDepth: number, linkPromoter: string };


export interface AppState {
  publicKey: JsonWebKey | null;
  privateKey: JsonWebKey | null;
  links: Map<string, LinkInfo>;
  redirects: Map<string, string>;   // keys are pseudoq urls - values are source urls 
  activeUrl: string | null;
  moniker: string;
  email: string;
  authprov: string;
  credits: number;
  jwt: string;
  lastErrorMessage: string;
  investments: UserLinkItem[];
  promotions: Dbt.urlString[];
  connectedUsers: Dbt.userName[];
  reachableUserCount: Dbt.integer;
  contents: Dbt.Content[];
  allTags: TagSelectOption[];
  currentContent: Dbt.Content;  // used to pass the target content to edit from settings page to contentedit page. It is ephemeral!!
  currentLink: Dbt.Link;  // used to pass the target link to edit from settings page to linkedit page. It is ephemeral!!
}

export function initState(): AppState {
  console.log("initState called");
  return {
    publicKey: null, privateKey: null, links: new Map<string, LinkInfo>(), redirects: new Map<string, string>(),
    activeUrl: null, moniker: 'unknown', authprov: '', email: '', credits: 0, jwt: '', lastErrorMessage: '',
    investments: [], promotions: [], connectedUsers: [], reachableUserCount: 0, contents: [], allTags: [], currentContent: null, currentLink: null
  };
}

export function getLinked(state: AppState, curl: string): LinkInfo {
  return state.links.get(prepareUrl(curl));
}

export function setLink(state: AppState, curl_: string, syn_: string, linkDepth: number, linkPromoter: string): AppState {
  let contentUrl = prepareUrl(curl_);
  let pseudoqUrl = prePrepareUrl(syn_);
  if (!pseudoqUrl.hash) pseudoqUrl.hash = '#' + contentUrl
  else pseudoqUrl.hash = pseudoqUrl.hash.replace(' ', '_');
  let info = state.links.get(contentUrl);
  if (info && format(info.pseudoqUrl) === format(pseudoqUrl)) return state;
  let links = new Map(state.links)
  links.set(contentUrl, { pseudoqUrl, linkDepth, linkPromoter });
  let redir = format(pseudoqUrl);
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
  st.links.forEach((v, k) => {
    links[k] = v;
  });
  let redirects = Object.create(null);
  st.redirects.forEach((v, k) => {
    redirects[k] = v;
  });
  return { ...st, links, redirects };
}

export function postDeserialize(st: any): AppState {
  let links = new Map<string, Url>();
  for (const k in st.links) {
    links.set(k, st.links[k]);
  };
  let redirects = new Map<string, string>();
  for (const k in st.redirects) {
    redirects.set(k, st.redirects[k]);
  };
  return { ...st, links, redirects };
}

export function expandedUrl(state: AppState, curl_: string = state.activeUrl): string {
  let curl = prepareUrl(curl_)
  let rslt = curl;
  if (isSeen(state, curl)) {
    let info: LinkInfo = state.links.get(curl);
    if (info) rslt = format(info.pseudoqUrl);
  }
  return rslt;
}

export function getRedirectUrl(state: AppState, curl_: string): string | null {
  let curl = prepareUrl(curl_)
  return state.redirects.get(curl);
}

export function setLoading(state: AppState, curl_: string): AppState {
  let curl = prepareUrl(curl_)
  let st = state;
  if (!isSeen(st, curl)) {
    console.log("setLoading called: " + curl_);
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
  let url = parse(curl, true, false);  // parse query string???
  if (!url) return null;
  if (url.protocol.startsWith("chrome")) return null;
  //url.query = "";
  //url.search = "";
  return url
}

export function prepareUrl(curl: string): string | null {
  let url = prePrepareUrl(curl)
  if (!url) return null;
  url.hash = '';
  return format(url);
}