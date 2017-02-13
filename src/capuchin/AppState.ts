import { Url, format, parse } from 'url';

export interface AppState {
  publicKey: JsonWebKey | null;
  privateKey: JsonWebKey | null;
  responses: Object[];
  links: any;   // keys are source urls (strings) - values are synereo links (Urls) | null
  redirects: any;   // keys are synereo urls (strings) - values are source urls 
  activeUrl: string | null;
  moniker: string;
  ampCredits: number;
  jwt: string;
}

export function initState(): AppState {
  console.log("initState called");
  return { publicKey: null, privateKey: null, responses: [], 
           links: Object.create(null), redirects: Object.create(null), 
           activeUrl: null, moniker: 'unknown', ampCredits: 0, jwt: '' };
}

export function isLinked(state: AppState, curl: string): boolean {
  let l = state.links[prepareUrl(curl)];
  return l !== undefined && l !== null;
}

export function setLink(state: AppState, curl_: string, syn_: string): AppState {
  let contentUrl = prepareUrl(curl_);
  let synereoUrl = prepareUrl(syn_);
  let url = state.links[contentUrl];
  if (url && format(url) === synereoUrl) return state;
  let links = { ...state.links, [contentUrl]: parse(synereoUrl) }
  let redirects = { ...state.redirects, [synereoUrl]: contentUrl }
  return { ...state, links, redirects };
}

export function expandedUrl(state: AppState, curl_: string = state.activeUrl): string {
  let curl = prepareUrl(curl_)
  let rslt = curl;
  if (isSeen(state, curl)) {
    let url: Url = state.links[curl];
    url.hash = '#' + curl;
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
  let i = Object.keys(state.redirects).indexOf(curl);
  if (i >= 0) return state.redirects[curl];
  return null;
}

export function setLoading(state: AppState, curl_: string): AppState {
  let curl = prepareUrl(curl_)
  let st = state;
  if (!isSeen(st, curl)) {
    let links = { ...st.links, [curl]: null }
    st = { ...st, links };
  }
  return st;
}

export function isSeen(state: AppState, curl: string): boolean {
  return Object.keys(state.links).indexOf(prepareUrl(curl)) >= 0;
}

export function setWaiting(state: AppState, curl_: string): AppState {
  let curl = prepareUrl(curl_)
  if (state.links[curl] == null) return state;
  let st = state;
  let links = { ...st.links, [curl]: null }
  return { ...st, links };
}

export function isWaiting(state: AppState, curl_: string): boolean {
  let curl = prepareUrl(curl_)
  return Object.keys(state.links).indexOf(curl) >= 0 && !state.links[curl];
}

export function prepareUrl(curl: string): string | null {
  let url = parse(curl, false, false);  // parse query string???
  if (!url) return null;
  if (url.protocol === "chrome:") return null;
  url.query = "";
  url.search = "";
  url.hash = '';
  return format(url);
}