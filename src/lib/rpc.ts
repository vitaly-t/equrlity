/**
 * The JSON-RPC 2.0 interface for Amplitude, implemented in TypeScript.
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
 *   allowHeaders: ["X-Requested-With", "Content-Type", "Authorization", "x-syn-client-version"],
 *   exposeHeaders: ["x-syn-moniker", "x-syn-credits", "x-syn-token", "x-syn-authprov", "x-syn-groups"],
 *  })
 * 
 * allowHeaders (supplied by client in request):
 * 
 *   - X-Requested-With: identifies http agent (usually a browser).
 *
 *   - Content-Type: must be "application/json". (Note that the capuchin client also supplies an Accept header with value "application/json". Presumably it is also neccessary?)
 *
 *   - Authorization:  Used to implement JWT (see https://jwt.io). If no Authorization Header is provided, the user is assumed to be a
 *                     new user. A new account will be created, and a new token will be generated and returned in the response 'x-syn-token' header.
 *                     The client should from then on supply the generated token using the Authorizatio header value "Bearer " followed by the token string.
 * 
 *   - x-syn-client-version: Used to identify the requesting client software. If not supplied the request is rejected (400).
 *                           If supplied it must be of the form {client-name}-{client-version}.
 *                           Currently, the allowed values for client-name are either "capuchin" or "lizard".
 *                           The client version is used by the capuchin reference client to automatically detect if the client needs upgrading      
 *        
 * exposeHeaders (supplied by server in response):
 * 
 *   - x-syn-moniker: the user's current moniker. 
 * 
 *   - x-syn-credits: the balance in the users account. (presumably Amps?)
 * 
 *   - x-syn-token: the jwt token identifying the current user.
 * 
 *   - x-syn-authprov: not currently used.  Will be used to allow social logins via Facebook, Twitter, GitHub etc, and also to allow for 
 *                     the same user account to be used across multiple devices.
 * 
 *   - x-syn-groups: not currently used.  Will be used to identify the user groups the user is a member of, allowing the client to present optional
 *                   interface functionality for administrators, content creators etc.
*/

// datatype defined in the database model (see lib/model.js).
import * as Dbt from './datatypes';

/**
 * The available json-rpc methods of the Amplitude API.  
 */

//TODO: rename "getUserLinks" to "loadSettingsPage"
export type Method = "addContent" | "initialize" | "changeMoniker" | "loadLink" | "getRedirect" | "changeSettings"
  | "getUserLinks" | "redeemLink" | "getPostBody" | "savePost" ;

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
 * addContent method
 * 
 * Issued whenever content is added to the system, and also when a url is "Amplified", "Re-Amplified", "Re-Invested".
 * 
 * publicKey: not currently used. can be empty, but must be supplied.
 * content: the url being added. 
 *   - If it is a synereo url, it will intepreted as a "Re-Amplify", unless the user has already (re-)amplified it, in which case it will be seen as a "Re-Invest".
 *   - otherwise it will be interpreted as fresh content, and will be added unless another user has already added it.
 * signature: currently ignored, but must be supplied.
 * linkDescription: used in construction of the generated return link, appearing after the '#'. 
 * amount: the amount being invested in the link (deducted from the user's "wallet").
 */
export type AddContentRequest = {
  publicKey: JsonWebKey;
  content: UrlString;
  signature: string;
  linkDescription: string;
  amount: Integer;
}

/**
 * returned if the call was successful ie. a new link was generated.
 * 
 * link: the newly generated link
 * linkDepth: the number of parents the new link has.  Will be zero if not a "Re-Amplify" or "Re-Invest"
 */
export type AddContentOk = {
  link: UrlString;
  linkDepth: Integer;
}

/**
 * returned if the content had already been added to the system, and the call was not a synereo url.
 * 
 * prevLink: the root link of the previous amplification.
 * linkAmplifier: the moniker of the user who originally added the content.
 */
export type AddContentAlreadyRegistered = {
  prevLink: UrlString;
  linkAmplifier: string;
}

/**
 * the & operator is a typescript Union, meaning that any of the fields in the components will be accepted. (covariant)
 */
export type AddContentResponse = AddContentOk & AddContentAlreadyRegistered;

/**
* internal type used by the server when sending an add content response back to the client (contravariant).
*/
export type SendAddContentResponse = AddContentOk | AddContentAlreadyRegistered;


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
 * linkAmplifier: the moniker of the user who owns the found link.
 */
export type LoadLinkResponse = {
  found: boolean;
  url?: UrlString;
  linkDepth?: Integer;
  linkAmplifier?: string;
}

/**
 * getRedirect method.
 * 
 * used when the client has detected that a synereo link url is being loaded, and it needs to be redirect the interface (tab page) to the
 * underlying content url.
 * 
 * linkUrl: the synereo url requiring the redirect info.
 */
export type GetRedirectRequest = { linkUrl: UrlString; }

/**
 * found: was the link found. If the link was not found, the remaining fields are not supplied.
 * contentUrl: the url the client should redirect to.
 * linkDepth: the number of parents of the link.
 * linkAmplifier: the moniker of the user who owns the link.
 */
export type GetRedirectResponse = {
  found: boolean;
  contentUrl?: UrlString;
  linkDepth?: Integer;
  linkAmplifier?: string;
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
  moniker: string;
  deposit: Integer;
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
 * posts: an array of information items for posts uploaded by the user.
 */
export type GetUserLinksResponse = {
  links: UserLinkItem[];
  promotions: Dbt.urlString[];
  connectedUsers: Dbt.userName[];
  reachableUserCount: Dbt.integer;
  posts: PostInfoItem[];
}

/**
 * a line item in the links array above.
 * 
 * linkId: the id of the link
 * contentUrl: the content url the link will redirect to.
 * linkDepth: the number of parent links in the chain (via re-amplification).
 * viewCount: the number of views the link has registered.
 * promotionsCount: the number of other users the link has been sent to.
 * deliveries: the number of other users who have actually received the link.
 *   - deliveries occur when other users themselves issue getUserLinks requests.
 * amount: the investment balance remaining in the link.
 */
export type UserLinkItem = {
  linkId: Dbt.linkId;
  contentUrl: Dbt.content;
  linkDepth: Dbt.integer;
  viewCount: Dbt.integer;
  promotionsCount: Dbt.integer;
  deliveriesCount: Dbt.integer;
  amount: Dbt.integer;
}

/**
 * a line item in the posts array above.
 * 
 * postId: the id of the post.
 * title: the post title.
 * tags: array of string tags assigned to the post.
 * published: the timestamp of when the post was published.
 * contentUrl: the content url of the post (if published).
 * rootLinkUrl: the url of the root link 
 */
export type PostInfoItem = {
  postId: Dbt.postId;
  title: string;
  tags: string[];
  published: Dbt.timestamp;
  contentUrl: Dbt.urlString;
  created: Dbt.created;
  updated: Dbt.updated;
};

export type GetPostBodyRequest = { postId: Dbt.postId };
export type GetPostBodyResponse = { body: string };

export type SavePostRequest = {
  postId: Dbt.postId;
  title: string;
  body: string;
  tags: string[];
  publish: boolean;
  investment?: Dbt.integer;
}

export type SavePostResponse = {
  posts: PostInfoItem[];
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

export type RequestBody = AddContentRequest | InitializeRequest | LoadLinkRequest | GetRedirectRequest | ChangeSettingsRequest
  | GetUserLinksRequest | RedeemLinkRequest | GetPostBodyRequest;

export type ResponseBody = AddContentResponse & SendAddContentResponse & InitializeResponse & LoadLinkResponse & GetRedirectResponse & ChangeSettingsResponse
  & GetUserLinksResponse & RedeemLinkResponse & GetPostBodyResponse;

/**
 * the follow is basically a thought bubble about how this api might be further improved.
 * feel free to ignore it.
 */

// internal to server.
export type RecvRequestBody = AddContentRequest & InitializeRequest & LoadLinkRequest & GetRedirectRequest & ChangeSettingsRequest
  & GetUserLinksRequest & RedeemLinkRequest & GetPostBodyRequest;

export type SendResponseBody = AddContentResponse | SendAddContentResponse | InitializeResponse | LoadLinkResponse | GetRedirectResponse | ChangeSettingsResponse
  | GetUserLinksResponse | RedeemLinkResponse | GetPostBodyResponse;

/*
export type RpcMethod<Request,Response> = {
  clientSendRequest: () => Request;
  serverReceiveRequest: (req: Request) => Response;
  serverSendResponse: () => Response;
  clientReceiveResponse: (rsp: Response) => void;
}
*/



/**
 * the json-rpc 2.0 interface as per the spec.
 */
export type Request = {
  jsonrpc: string,  // always "2.0"
  id: number
  method: Method,  // statically enforced by the compiler to be one of constituent values
  params: RequestBody,
}

export type Error = {
  id: number;
  error: { code: number, message: string };
}

export type Result = {
  id: number;
  result: ResponseBody;  // should really be a union type of all available Response Types
}

export type Response = Result & Error;

