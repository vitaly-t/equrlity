import { Url, format, parse } from 'url';

export interface LinkInfo { synereoUrl: Url, linkDepth: number, linkAmplifier: string };

export type PopupMode = "Amplify" | "Settings";

export interface AppState {
  publicKey: JsonWebKey | null;
  privateKey: JsonWebKey | null;
  responses: Object[];
  links: Map<string, LinkInfo>;
  redirects: Map<string, string>;   // keys are synereo urls (strings) - values are source urls 
  activeUrl: string | null;
  moniker: string;
  ampCredits: number;
  jwt: string;
  mode: PopupMode;
  lastErrorMessage: string;
}

export function initState(): AppState {
  console.log("initState called");
  return {
    publicKey: null, privateKey: null, responses: [],
    links: new Map<string, LinkInfo>(), redirects: new Map<string, string>(),
    activeUrl: null, moniker: 'unknown', ampCredits: 0, jwt: '', mode: "Amplify", lastErrorMessage: ''
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

export function serializeLinks(links: Map<string,Url>): any {
   let rslt = Object.create(null);
   links.forEach( (v,k) => {
     rslt[k] = v;
   });
   return rslt;
}

export function deserializeLinks(links: any): Map<string,Url> {
   let rslt = new Map<string,Url>();
   for (const k in links) {
     rslt.set(k, links[k]);
   };
   return rslt;
}

export function expandedUrl(state: AppState, curl_: string = state.activeUrl): string {
  let curl = prepareUrl(curl_)
  let rslt = curl;
  if (isSeen(state, curl)) {
    let info: LinkInfo = state.links.get(curl);
    let url: Url = info.synereoUrl;
    if (url) rslt = format(url);
  }
  return rslt;
}

export function isSynereoLink(url: Url): boolean {
  let srch = process.env.NODE_ENV == "development" ? "localhost:8080" : "synereo.com";
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
  return state.links.get(curl) == null;
}

function prePrepareUrl(curl: string): Url | null {
  let url = parse(curl, false, false);  // parse query string???
  if (!url) return null;
  if (url.protocol === "chrome:") return null;
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