export type Method = "addContent" | "initialize" | "changeMoniker" | "loadLinks" | "getRedirect" | "changeSettings";

export type UrlString = string;
export type Integer = number;

export type AddContentRequest = {
  publicKey: JsonWebKey;
  content: UrlString;
  signature: string;
  amount: Integer;
}

export type InitializeRequest = {
  publicKey: JsonWebKey;
}

export type AddContentOk = {
  link: UrlString;
}      

export type AddContentAlreadyRegistered = {
  prevLink: UrlString;
}      

export type SendAddContentResponse = AddContentOk | AddContentAlreadyRegistered;
export type RecvAddContentResponse = AddContentOk & AddContentAlreadyRegistered;

export type LoadLinksRequest = {
  publicKey: JsonWebKey;
  url: UrlString;
}

export type LoadLinksResponseItem = {
   url: UrlString;
   hitCount: Integer;
   amount: Integer; 
}

export type LoadLinksResponse = Array<LoadLinksResponseItem>;

export type GetRedirectRequest = { linkUrl: UrlString; }

export type GetRedirectResponse = { contentUrl: UrlString; }

export type ChangeSettingsRequest = {
  moniker: string;
  deposit: Integer;
  email: string;
}

export type ChangeSettingsResponse = { ok: boolean; }

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

