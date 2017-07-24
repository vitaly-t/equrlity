import { Url, format, parse } from 'url';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import * as Utils from '../lib/utils';
import { TagSelectOption } from '../lib/tags';


export interface AppState {
  publicKey: JsonWebKey | null;
  privateKey: JsonWebKey | null;
  jwt: string;

  // server sent
  user: Dbt.User;
  userNames: TagSelectOption[];
  shares: Rpc.UserLinkItem[];
  feed: Rpc.FeedItem[];
  contents: Dbt.Content[];
  allTags: TagSelectOption[];

  // ephemeral
  lastErrorMessage: string;
  links: any; // Map<string, Dbt.Content>;
  matchedTags: any // Map<string, Dbt.tags>;
  activeUrl: string | null;
}

export function initState(): AppState {
  console.log("initState called");
  return {
    publicKey: null, privateKey: null, links: Object.create(null), matchedTags: Object.create(null), userNames: [], user: null,
    activeUrl: null, jwt: '', lastErrorMessage: '', feed: [], shares: [], contents: [], allTags: []
  };
}

export function getBookmark(state: AppState, curl: string): Dbt.Content {
  //return state.links.get(prepareUrl(curl));
  return state.links[prepareUrl(curl)];
}

// serialization occurs by sendMessages between background "page"" and popup panel
// Maps don't serialize :-(
export function preSerialize(st: AppState): any {
  return st;
  /*
  let links = Object.create(null);
  st.links.forEach((v, k) => {
    links[k] = v;
  });
  let matchedTags = Object.create(null);
  st.matchedTags.forEach((v, k) => {
    matchedTags[k] = v;
  });
  return { ...st, links, matchedTags };
  */
}

export function postDeserialize(st: any): AppState {
  if (!st) return initState();
  return st;
  /*
  let links = new Map<string, Url>();
  for (const k in st.links) {
    links.set(k, st.links[k]);
  };
  let matchedTags = new Map<string, Dbt.tags>();
  for (const k in st.matchedTags) {
    links.set(k, st.matchedTags[k]);
  };
  return { ...st, links, matchedTags };
  */
}

export function setLoading(state: AppState, curl_: string): AppState {
  let curl = prepareUrl(curl_)
  let st = state;
  if (!isSeen(st, curl)) {
    console.log("setLoading called: " + curl_);
    let links = Object.create(null); //new Map(st.links);
    links[curl] = null; //links.set(curl, null);
    st = { ...st, links };
  }
  return st;
}

export function isSeen(state: AppState, curl: string): boolean {
  //return state.links.has(prepareUrl(curl));
  return (curl in state.links);
}

export function setWaiting(state: AppState, curl_: string): AppState {
  let curl = prepareUrl(curl_)
  //if (state.links.get(curl)) return state;
  if (state.links[curl]) return state;
  let st = state;
  let links = Object.create(null); //new Map(st.links);
  links[curl] = null; //links.set(curl, null);
  return { ...st, links };
}

export function isWaiting(state: AppState, curl_: string): boolean {
  let curl = prepareUrl(curl_)
  //return state.links.get(curl) === null;
  return (curl in state.links) && state.links[curl] === null;
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

export function userNameFromId(st: AppState, id: Dbt.userId) {
  let i = st.userNames.findIndex(e => e.value === id);
  return i >= 0 ? st.userNames[i].label : '???';
}

export function userIdFromName(st: AppState, nm: Dbt.userName) {
  let i = st.userNames.findIndex(e => e.label === nm);
  return i >= 0 ? st.userNames[i].value : null;
}