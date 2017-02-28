// This file is generated - it should not be edited


export type authId = string;
export type authProvider = "ip" | "facebook" | "github" | "twitter" | "linkedin";
export type binary = ArrayBuffer;
export type contentCryptId = ArrayBuffer;
export type contentType = "url" | "video" | "post" | "audio";
export type created = Date;
export type date = Date;
export type email = string;
export type integer = number;
export type ipAddress = string;
export type json = string;
export type linkId = number;
export type linkDescription = string;
export type percentage = number;
export type publicKey = any;
export type text = string;
export type timestamp = Date;
export type updated = Date;
export type userGroup = "admin" | "author" | "member";
export type urlString = string;
export type userName = string;
export type uuid = string;
export type postId = number;
export type content = string;
export type contentId = number;
export type userId = string;
export type varchar_160 = string;
export type varchar_20 = string;

export interface User {
  readonly userId: userId | null,
  readonly publicKey: publicKey | null,
  readonly userName: userName | null,
  readonly email: email | null,
  readonly ipAddress: ipAddress | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly ampCredits: integer | null,
  readonly groups: userGroup[] | null
};

export interface Auth {
  readonly authProvider: authProvider | null,
  readonly authId: authId | null,
  readonly userId: userId | null,
  readonly created: created | null,
  readonly updated: updated | null
};

export interface Content {
  readonly contentId: contentId | null,
  readonly contentType: contentType | null,
  readonly userId: userId | null,
  readonly content: content | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly cryptHash: binary | null
};

export interface Link {
  readonly linkId: linkId | null,
  readonly userId: userId | null,
  readonly contentId: contentId | null,
  readonly linkDescription: linkDescription | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly prevLink: linkId | null,
  readonly hitCount: integer | null,
  readonly amount: integer | null
};

export interface Post {
  readonly postId: postId | null,
  readonly userId: userId | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly contentId: contentId | null,
  readonly title: varchar_160 | null,
  readonly body: text | null,
  readonly tags: varchar_20[] | null,
  readonly published: timestamp | null
};

export interface Invitation {
  readonly ipAddress: ipAddress | null,
  readonly linkId: linkId | null,
  readonly created: created | null,
  readonly updated: updated | null
};

export interface Promotion {
  readonly linkId: linkId | null,
  readonly userId: userId | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly delivered: timestamp | null
};

export interface View {
  readonly userId: userId | null,
  readonly linkId: linkId | null,
  readonly created: created | null,
  readonly updated: updated | null
};

// end of generated types