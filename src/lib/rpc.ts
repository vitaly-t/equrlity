import * as Dbt from './datatypes';

export type Method = "addContent" | "initialize" | "changeMoniker" | "loadLink" | "getRedirect" | "changeSettings" 
                   | "getUserLinks" | "redeemLink" ;

export type UrlString = string;
export type Integer = number;

export type AddContentRequest = {
  publicKey: JsonWebKey;
  content: UrlString;
  signature: string;
  linkDescription: string;
  amount: Integer;
}

export type InitializeRequest = {
  publicKey: JsonWebKey;
}

export type AddContentOk = {
  link: UrlString;
  linkDepth: Integer;
}      

export type AddContentAlreadyRegistered = {
  prevLink: UrlString;
  linkAmplifier: string;
}      

export type SendAddContentResponse = AddContentOk | AddContentAlreadyRegistered;
export type RecvAddContentResponse = AddContentOk & AddContentAlreadyRegistered;

export type LoadLinkRequest = {
  publicKey: JsonWebKey;
  url: UrlString;
}

export type LoadLinkResponse = {
  found: boolean;
  url: UrlString;
  linkDepth: Integer;
  linkAmplifier: string;
}

export type GetRedirectRequest = { linkUrl: UrlString; }

export type GetRedirectResponse = { found: boolean, contentUrl: UrlString; linkDepth: Integer, linkAmplifier: string }

export type ChangeSettingsRequest = {
  moniker: string;
  deposit: Integer;
  email: string;
}

export type ChangeSettingsResponse = { ok: boolean; }

export type GetUserLinksRequest = {}

export type UserLinkItem = {
  linkId: Dbt.linkId;
  contentUrl: Dbt.content;
  linkDepth: Dbt.integer;
  viewCount: Dbt.integer;
  promotionsCount: Dbt.integer;
  deliveriesCount: Dbt.integer;
  amount: Dbt.integer;
}

export type GetUserLinksResponse = { 
  links: UserLinkItem[]; 
  promotions: Dbt.urlString[]; 
  connectedUsers: Dbt.userName[]; 
  reachableUserCount: Dbt.integer;
}

export type RedeemLinkRequest = { linkId: Dbt.linkId; }
export type RedeemLinkResponse = { links: UserLinkItem[]; }

export type Request = {
   jsonrpc: string, 
   method: Method, 
   params: any, 
   id: number} 

export type Error = {
  id: number;
  error: {message: string };
}   

export type Result = {
  id: number;
  result: any;
}

export type Response = Result & Error;   

