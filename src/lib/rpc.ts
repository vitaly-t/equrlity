/**
 * The JSON-RPC 2.0 interface for PseduoQURL, implemented in TypeScript.
 * 
 * See http://www.jsonrpc.org/specification for technical details of the rpc protocol.
 * 
 * The convention used here is that each method is defined by a request type named by capitalizing the method name and appending "Request" to it.
 * Similarly for the associated response.
 *
 * Thus the "addContent" method is defined by a request type of "AddContentRequest" and a response type of "AddContentResponse".
 * 
 * HTTP Headers.
 * 
 * Some information communicated between the server and client does not actually appear in the rpc interface, but is instead sent and received via
 * the use of custom http headers. 
 * 
 * from our CORS instantiation (see /src/server/server.ts)
 *  cors({
 *   origin: "*",
 *   allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
 *   allowHeaders: ["X-Requested-With", "Content-Type", "Authorization", "x-psq-client-version"],
 *   exposeHeaders: ["x-psq-moniker", "x-psq-credits", "x-psq-token", "x-psq-authprov", "x-psq-groups"],
 *  })
 * 
 * allowHeaders (supplied by client in request):
 * 
 *   - X-Requested-With: identifies http agent (usually a browser).
 *
 *   - Content-Type: must be "application/json". (Note that the capuchin client also supplies an Accept header with value "application/json". Presumably it is also neccessary?)
 *
 *   - Authorization:  Used to implement JWT (see https://jwt.io). If no Authorization Header is provided, the user is assumed to be a
 *                     new user. A new account will be created, and a new token will be generated and returned in the response 'x-psq-token' header.
 *                     The client should from then on supply the generated token using the Authorizatio header value "Bearer " followed by the token string.
 * 
 *   - x-psq-client-version: Used to identify the requesting client software. If not supplied the request is rejected (400).
 *                           If supplied it must be of the form {client-name}-{client-version}.
 *                           Currently, the allowed values for client-name are either "capuchin" or "lizard".
 *                           The client version is used by the capuchin reference client to automatically detect if the client needs upgrading      
 *        
 * exposeHeaders (supplied by server in response):
 * 
 *   - x-psq-moniker: the user's current moniker. 
 * 
 *   - x-psq-email: the user's current email address. 
 * 
 *   - x-psq-credits: the balance in the users account. 
 * 
 *   - x-psq-token: the jwt token identifying the current user.
 * 
 *   - x-psq-authprov: not currently used.  Will be used to allow social logins via Facebook, Twitter, GitHub etc, and also to allow for 
 *                     the same user account to be used across multiple devices.
 * 
 *   - x-psq-groups: not currently used.  Will be used to identify the user groups the user is a member of, allowing the client to present optional
 *                   interface functionality for administrators, content creators etc.
*/

// datatype defined in the database model (see lib/model.js).
import * as Dbt from './datatypes';

/**
 * The available json-rpc methods of the PseudoQURL API.  
 */

//TODO: rename "getUserLinks" to "loadSettingsPage"
export type Method = "initialize" | "authenticate" | "promoteContent" | "promoteLink" | "loadLink" | "getRedirect" | "changeSettings"
  | "getUserLinks" | "redeemLink" | "getPostBody" | "saveContent" | "removeContent" | "transferCredits";

/**
 * Informational type tags used to indicate intended usage.
 */
export type UrlString = string;
export type Integer = number;

export type InitializeRequest = {
  publicKey: JsonWebKey;
}

export type InitializeResponse = {
  ok: boolean;
  redirectUrl?: UrlString;
}

export type PromoteContentRequest = {
  contentId: Dbt.contentId;
  linkDescription: string;
  amount: Integer;
  publicKey: JsonWebKey;
  signature: string;
}

export type PromoteContentResponse = {
  url: Dbt.urlString | null;
}

export type PromoteLinkRequest = {
  url: Dbt.urlString;
  title: string;
  comment: string;
  tags: string[];
  amount: Integer;
  publicKey: JsonWebKey;
  signature: string;
}

export type PromoteLinkResponse = {
  link?: UrlString;
  linkDepth: Integer;
  prevLink?: UrlString;
  linkPromoter?: string;
  contents?: ContentInfoItem[];
}

export type LoadLinkRequest = {
  publicKey: JsonWebKey;
  url: UrlString;
}

export type LoadLinkResponse = {
  found: boolean;
  url?: UrlString;
  linkDepth?: Integer;
  linkPromoter?: string;
}

export type GetRedirectRequest = { linkUrl: UrlString; }

export type GetRedirectResponse = {
  found: boolean;
  contentUrl?: UrlString;
  linkDepth?: Integer;
  linkPromoter?: string;
}

export type ChangeSettingsRequest = {
  userName: string;
  email: string;
}

export type ChangeSettingsResponse = { ok: boolean; }

export type GetUserLinksRequest = {}

export type GetUserLinksResponse = {
  links: UserLinkItem[];
  promotions: Dbt.urlString[];
  connectedUsers: Dbt.userName[];
  reachableUserCount: Dbt.integer;
  contents: ContentInfoItem[];
}

export type UserLinkItem = {
  linkId: Dbt.linkId;
  contentUrl: Dbt.urlString;
  info: ContentInfoItem;
  linkDepth: Dbt.integer;
  viewCount: Dbt.integer;
  promotionsCount: Dbt.integer;
  deliveriesCount: Dbt.integer;
  amount: Dbt.integer;
}

export type ContentInfoItem = {
  contentId: Dbt.contentId;
  contentType: Dbt.contentType;
  content: string;
  mime_ext: string;
  title: string;
  tags: string[];
  published: Dbt.timestamp;
  created: Dbt.created;
  updated: Dbt.updated;
};

export type SaveContentRequest = {
  contentId: Dbt.contentId;
  contentType: Dbt.contentType;
  mime_ext: string;
  title: string;
  content?: string;
  tags: string[];
  publish: boolean;
  investment?: Dbt.integer;
}

export type SaveContentResponse = {
  contents: ContentInfoItem[];
};

export type RedeemLinkRequest = { linkId: Dbt.linkId; }

export type RedeemLinkResponse = { links: UserLinkItem[]; }

export type RemoveContentRequest = { contentId: Dbt.contentId; }

export type RemoveContentResponse = { ok: boolean; }

export type TransferCreditsRequest = { transferTo: Dbt.userName; amount: Dbt.integer }

export type TransferCreditsResponse = { ok: boolean; }

export type AuthenticateRequest = { provider: string }

export type AuthenticateResponse = { ok: boolean; }

export type RequestBody = PromoteContentRequest | PromoteLinkRequest | InitializeRequest | LoadLinkRequest | GetRedirectRequest | ChangeSettingsRequest
  | GetUserLinksRequest | RedeemLinkRequest | RemoveContentRequest | TransferCreditsRequest | AuthenticateRequest;

export type ResponseBody = PromoteContentResponse & PromoteLinkResponse & InitializeResponse & LoadLinkResponse & GetRedirectResponse & ChangeSettingsResponse
  & GetUserLinksResponse & RedeemLinkResponse & RemoveContentResponse & TransferCreditsResponse & AuthenticateResponse;

// internal to server.
export type RecvRequestBody = PromoteContentRequest & PromoteLinkRequest & InitializeRequest & LoadLinkRequest & GetRedirectRequest & ChangeSettingsRequest
  & GetUserLinksRequest & RedeemLinkRequest & RemoveContentRequest & TransferCreditsRequest & AuthenticateRequest;

export type SendResponseBody = PromoteContentResponse | PromoteLinkResponse | InitializeResponse | LoadLinkResponse | GetRedirectResponse | ChangeSettingsResponse
  | GetUserLinksResponse | RedeemLinkResponse | RemoveContentResponse | TransferCreditsResponse | AuthenticateResponse;

export type Handler<Request, Response> = (req: Request) => Promise<Response>;

export type Request = {
  jsonrpc: string,  // always "2.0"
  id: number
  method: Method,
  params: RequestBody,
}

export type Error = {
  id: number;
  error: { code?: number, message: string };
}

export type Result = {
  id: number;
  result: ResponseBody;
}

export type Response = Result & Error;

