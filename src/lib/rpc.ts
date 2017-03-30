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

/**
 * initialize method.
 * 
 * Issued whenever a client connects.  
 * 
 * if the user has not been seen before (ie. presents no jwt token), a new account is automatically created.
 * 
 * publicKey: for future security implementation and is currently ignored. Can be left blank, but must be supplied.
 */
export type InitializeRequest = {
  publicKey: JsonWebKey;
}

/**
 * ok: success (or failure).
 */
export type InitializeResponse = {
  ok: boolean;
  redirectUrl?: UrlString;
}

/**
 * promoteContent method
 * 
 * used when to promote newly added content.
 * 
 * contentId: the id of the content to published. 
 * linkDescription: used in construction of the generated return link, appearing after the '#'. 
 * amount: the amount being invested in the link (deducted from the user's credit balance).
 */
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

/**
 * promoteLink method
 * 
 * used when a url is "Promote"d (or "Re-Invest"ed).
 * 
 * url: the url being added. 
 *   - it will intepreted as a "Promote", unless the user has already promoted it, in which case it will be seen as a "Re-Invest".
 * linkDescription: used in construction of the generated return link, appearing after the '#'. 
 * tags: classifying tags array
 * amount: the amount being invested in the link (deducted from the user's credit balance).
 * publicKey: used in conjunction with signature to prevent tampering.
 * signature: see publicKey.
 */
export type PromoteLinkRequest = {
  url: Dbt.urlString;
  linkDescription: string;
  tags: string[];
  amount: Integer;
  publicKey: JsonWebKey;
  signature: string;
}

/**
 * link: the newly generated link
 * linkDepth: the number of parents the new link has. 
 */
export type PromoteLinkResponse = {
  link?: UrlString | null;
  linkDepth: Integer;
  prevLink?: UrlString;
  linkPromoter?: string;
}


/**
 * loadLink method.
 * 
 * issued whenever a tab page (url) is being loaded, to convey what the system currently knows about the url (if anything).
 * 
 * the public key is currently ignored.
 */
export type LoadLinkRequest = {
  publicKey: JsonWebKey;
  url: UrlString;
}

/**
 * found: was the link found. If the link was not found, the remaining fields are not supplied.
 * url: the url of the found link.
 * linkDepth: the number of parents of the found link.
 * linkPromoter: the moniker of the user who owns the found link.
 */
export type LoadLinkResponse = {
  found: boolean;
  url?: UrlString;
  linkDepth?: Integer;
  linkPromoter?: string;
}

/**
 * getRedirect method.
 * 
 * used when the client has detected that a pseudoq link url is being loaded, and it needs to be redirect the interface (tab page) to the
 * underlying content url.
 * 
 * linkUrl: the pseudoq url requiring the redirect info.
 */
export type GetRedirectRequest = { linkUrl: UrlString; }

/**
 * found: was the link found. If the link was not found, the remaining fields are not supplied.
 * contentUrl: the url the client should redirect to.
 * linkDepth: the number of parents of the link.
 * linkPromoter: the moniker of the user who owns the link.
 */
export type GetRedirectResponse = {
  found: boolean;
  contentUrl?: UrlString;
  linkDepth?: Integer;
  linkPromoter?: string;
}

/**
 * changeSettings method.
 * 
 * used when the client wishes to change the user's current system settings.
 * 
 * moniker: the user's chosen nickname.
 * email: currently ignored. can be blank, but must be supplied.
 * deposit: allows the user to summarily give themselves more currency, and will be removed once the system goes live.
 */
export type ChangeSettingsRequest = {
  userName: string;
  email: string;
}

/**
 * ok: was the change request successful?
 */
export type ChangeSettingsResponse = { ok: boolean; }

/**
 * getUserLinks method
 * 
 * used when the client wishes to display the user's current status.
 * (should be renamed to "loadSettingsPageRequest")
 */
export type GetUserLinksRequest = {}

/**
 * links: an array of information items for links owned by the user (see below).
 * promotions: a list of links promoted by other system users to the current user, that have not previously been delivered.
 * connectedUsers: a list of other users' monikers to which the user is directly connected.
 * reachableUserCount: the number of others user's that the user is directly or indirectly connected to by transitive closure.
 * contents: an array of information items for contents uploaded by the user.
 */
export type GetUserLinksResponse = {
  links: UserLinkItem[];
  promotions: Dbt.urlString[];
  connectedUsers: Dbt.userName[];
  reachableUserCount: Dbt.integer;
  contents: ContentInfoItem[];
}

/**
 * a line item in the links array above.
 * 
 * linkId: the id of the link
 * contentUrl: the content url the link will redirect to.
 * linkDepth: the number of parent links in the chain (via re-promotion).
 * viewCount: the number of views the link has registered.
 * promotionsCount: the number of other users the link has been sent to.
 * deliveries: the number of other users who have actually received the link.
 *   - deliveries occur when other users themselves issue getUserLinks requests.
 * amount: the investment balance remaining in the link.
 */
export type UserLinkItem = {
  linkId: Dbt.linkId;
  contentUrl: Dbt.urlString;
  linkDepth: Dbt.integer;
  viewCount: Dbt.integer;
  promotionsCount: Dbt.integer;
  deliveriesCount: Dbt.integer;
  amount: Dbt.integer;
}

/**
 * a line item in the contents array above.
 * 
 * contentId: the id of the content.
 * title: the content title.
 * tags: array of string tags assigned to the content.
 * published: the timestamp of when the content was published.
 * contentUrl: the content url of the content (if published).
 * rootLinkUrl: the url of the root link 
 */
export type ContentInfoItem = {
  contentId: Dbt.contentId;
  contentType: Dbt.contentType;
  mime_ext: string;
  title: string;
  tags: string[];
  published: Dbt.timestamp;
  created: Dbt.created;
  updated: Dbt.updated;
};

export type GetPostBodyRequest = { contentId: Dbt.contentId };
export type GetPostBodyResponse = { body: string | null };

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

/**
 * redeemLink method.
 * 
 * used to remove a link from the system, and return the balance remaining in the link back to the user's account.
 *
 * linkId: the id of the link to be redeemed 
 */
export type RedeemLinkRequest = { linkId: Dbt.linkId; }

/**
* links: the array of link information items owned by the user, after the link has been redeemed.
*/
export type RedeemLinkResponse = { links: UserLinkItem[]; }


/**
 * removeContent method.
 * 
 * used to remove a content item from the system. Implicitly redeems all links associated with the content.
 * will only work if the current user is the owner of the content.
 * 
 * content: the url of the content to be removed 
 */
export type RemoveContentRequest = { contentId: Dbt.contentId; }

/**
* ok: true if successful, false probably indicates that content is not owned by the current user.
*/
export type RemoveContentResponse = { ok: boolean; }

/**
 * transferCredits method.
 * 
 * allows a user to transfer credits to another user.
 *
 * transferTo: the moniker of the user to transfer to.
 * amount: the number of credits to transfer. 
 */
export type TransferCreditsRequest = { transferTo: Dbt.userName; amount: Dbt.integer }

/**
* links: the array of link information items owned by the user, after the link has been redeemed.
* 
* ok: true if successful, false indicates that content is not owned by the current user.
*/
export type TransferCreditsResponse = { ok: boolean; }

/**
 * authenticate method.
 * 
 * authenticate via a social login provider.
 *
 * provider: the provider to authenticate with.
 */
export type AuthenticateRequest = { provider: string }

/**
* links: the array of link information items owned by the user, after the link has been redeemed.
* 
* ok: true if successful, false indicates that content is not owned by the current user.
*/
export type AuthenticateResponse = { ok: boolean; }


// aggregate the above types

export type RequestBody = PromoteContentRequest | PromoteLinkRequest | InitializeRequest | LoadLinkRequest | GetRedirectRequest | ChangeSettingsRequest
  | GetUserLinksRequest | RedeemLinkRequest | GetPostBodyRequest | RemoveContentRequest | TransferCreditsRequest | AuthenticateRequest;

export type ResponseBody = PromoteContentResponse & PromoteLinkResponse & InitializeResponse & LoadLinkResponse & GetRedirectResponse & ChangeSettingsResponse
  & GetUserLinksResponse & RedeemLinkResponse & GetPostBodyResponse & RemoveContentResponse & TransferCreditsResponse & AuthenticateResponse;

// internal to server.
export type RecvRequestBody = PromoteContentRequest & PromoteLinkRequest & InitializeRequest & LoadLinkRequest & GetRedirectRequest & ChangeSettingsRequest
  & GetUserLinksRequest & RedeemLinkRequest & GetPostBodyRequest & RemoveContentRequest & TransferCreditsRequest & AuthenticateRequest;

export type SendResponseBody = PromoteContentResponse | PromoteLinkResponse | InitializeResponse | LoadLinkResponse | GetRedirectResponse | ChangeSettingsResponse
  | GetUserLinksResponse | RedeemLinkResponse | GetPostBodyResponse | RemoveContentResponse | TransferCreditsResponse | AuthenticateResponse;

export type Handler<Request, Response> = (req: Request) => Promise<Response>;

/**
 * the json-rpc 2.0 interface as per the spec.
 */
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

