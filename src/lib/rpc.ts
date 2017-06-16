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
 *                     The client should from then on supply the generated token using the Authorization header value "Bearer " followed by the token string.
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
export type Method = "initialize" | "authenticate" | "promoteContent" | "bookmarkLink" | "loadLink" | "getRedirect" | "changeSettings"
  | "getUserContents" | "loadContent" | "getUserSettings" | "getUserLinks" | "redeemLink" | "saveContent" | "saveLink" | "removeContent" | "transferCredits"
  | "aditComment" | "dismissSquawks" | "updateFeed";

export type UrlString = string;
export type Integer = number;

export type InitializeRequest = {
  publicKey: JsonWebKey;
}

export type FeedItem = {
  created: Dbt.timestamp;
  source: Dbt.userName;
  url: Dbt.urlString;
  tags: Dbt.tags;
  comment: string;
}

export type InitializeResponse = {
  ok: boolean;
  profile_pic: Dbt.db_hash;
  allTags: string[];
  redirectUrl?: UrlString;
  feed: FeedItem[];
}

export type UpdateFeedRequest = {}
export type UpdateFeedResponse = {
  feed: FeedItem[];
}

export type PromoteContentRequest = {
  contentId: Dbt.contentId;
  title: string;
  comment: string;
  tags: string[];
  amount: Integer;
  signature: string;
  paymentSchedule: Integer[];
}

export type PromoteContentResponse = {
  link: Dbt.Link;
}

export interface CommentItem extends Dbt.Comment {
  readonly userName: Dbt.userName,
};

export type LoadContentRequest = {
  contentId: Dbt.contentId;
}

export type LoadContentResponse = {
  content: Dbt.Content;
  owner: Dbt.userName;
  comments: CommentItem[];
}

export type AditCommentRequest = {
  commentId?: Dbt.commentId;
  contentId: Dbt.contentId;
  comment: string;
  parent: Dbt.commentId;
  signature: string;
}

export type AditCommentResponse = {
  comment: CommentItem;
}

export type BookmarkLinkRequest = {
  contentId?: Dbt.contentId;
  url: Dbt.urlString;
  title: string;
  comment: string;
  tags: string[];
  signature: string;
  squawk?: boolean;
  amount?: number;
}

export type BookmarkLinkResponse = {
  content: Dbt.Content;
  link?: Dbt.Link;
}

export type LoadLinkRequest = {
  url: UrlString;
}

export type LoadLinkResponse = {
  content: Dbt.Content;
}

export type UserFollowing = {
  userName: string;
  subscriptions: Dbt.tags;
  blacklist: Dbt.tags;
}

export type UserSettings = {
  userName: string;
  email: string;
  homePage: Dbt.urlString;
  info: string;
  profile_pic?: Dbt.db_hash;
  subscriptions: Dbt.tags;
  blacklist: Dbt.tags;
  following: Dbt.userName[];
  allUsers?: Dbt.userName[];
}

export type GetUserSettingsRequest = {}
export type GetUserSettingsResponse = UserSettings;

export type ChangeSettingsRequest = UserSettings;
export type ChangeSettingsResponse = { ok: boolean; }

export type GetUserContentsRequest = {}
export type GetUserContentsResponse = {
  contents: Dbt.Content[];
}

export type GetUserLinksRequest = {}

export type GetUserLinksResponse = {
  links: UserLinkItem[];
  promotions: Dbt.urlString[];
  connectedUsers: Dbt.userName[];
  reachableUserCount: Dbt.integer;
  allTags: string[];
}

export type UserLinkItem = {
  link: Dbt.Link;
  linkDepth: Dbt.integer;
  viewCount: Dbt.integer;
  promotionsCount: Dbt.integer;
  deliveriesCount: Dbt.integer;
}

export type SaveContentRequest = { content: Dbt.Content; }

export type SaveContentResponse = { content: Dbt.Content; }

export type SaveLinkRequest = { link: Dbt.Link; }

export type SaveLinkResponse = { link: Dbt.Link; }

export type RedeemLinkRequest = { linkId: Dbt.linkId; }

export type RedeemLinkResponse = { links: UserLinkItem[]; }

export type RemoveContentRequest = { contentId: Dbt.contentId; }

export type RemoveContentResponse = { ok: boolean; }

export type TransferCreditsRequest = { transferTo: Dbt.userName; amount: Dbt.integer; }

export type TransferCreditsResponse = { ok: boolean; }

export type AuthenticateRequest = { provider: string; }

export type AuthenticateResponse = { ok: boolean; }

export type DismissSquawksRequest = { urls: Dbt.urlString[]; save?: boolean }

export type DismissSquawksResponse = { ok: boolean; }

export type RequestBody = PromoteContentRequest | BookmarkLinkRequest | InitializeRequest | LoadLinkRequest | ChangeSettingsRequest
  | GetUserContentsRequest | GetUserLinksRequest | RedeemLinkRequest | SaveLinkRequest | SaveContentRequest | LoadContentRequest | RemoveContentRequest
  | TransferCreditsRequest | AuthenticateRequest | AditCommentRequest | GetUserSettingsRequest | DismissSquawksRequest | UpdateFeedRequest;

export type ResponseBody = PromoteContentResponse & BookmarkLinkResponse & InitializeResponse & LoadLinkResponse & ChangeSettingsResponse
  & GetUserContentsResponse & GetUserLinksResponse & RedeemLinkResponse & SaveLinkResponse & SaveContentResponse & LoadContentResponse & RemoveContentResponse
  & TransferCreditsResponse & AuthenticateResponse & AditCommentResponse & GetUserSettingsResponse & DismissSquawksResponse & UpdateFeedResponse;

// internal to server.
export type RecvRequestBody = PromoteContentRequest & BookmarkLinkRequest & InitializeRequest & LoadLinkRequest & ChangeSettingsRequest
  & GetUserContentsRequest & GetUserLinksRequest & RedeemLinkRequest & SaveLinkRequest & SaveContentRequest & LoadContentRequest & RemoveContentRequest
  & TransferCreditsRequest & AuthenticateRequest & AditCommentRequest & GetUserSettingsRequest & DismissSquawksRequest & UpdateFeedRequest;

export type SendResponseBody = PromoteContentResponse | BookmarkLinkResponse | InitializeResponse | LoadLinkResponse | ChangeSettingsResponse
  | GetUserContentsResponse | GetUserLinksResponse | RedeemLinkResponse | SaveLinkResponse | SaveContentResponse | LoadContentResponse | RemoveContentResponse
  | TransferCreditsResponse | AuthenticateResponse | AditCommentResponse | GetUserSettingsResponse | DismissSquawksResponse | UpdateFeedResponse;

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

