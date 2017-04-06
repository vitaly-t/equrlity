// This file is generated - it should not be edited


export type authId = string;
export type authProvider = "facebook" | "github" | "twitter" | "linkedin" | "chrome";
export type binary = Buffer;
export type contentType = "video" | "post" | "audio" | "image";
export type created = Date;
export type date = Date;
export type email = string;
export type integer = number;
export type ipAddress = string;
export type json = string;
export type linkId = number;
export type linkDescription = string;
export type percentage = number;
export type text = string;
export type timestamp = Date;
export type updated = Date;
export type userGroup = "admin" | "author" | "member";
export type urlString = string;
export type userName = string;
export type uuid = string;
export type content = string;
export type blobId = number;
export type contentId = number;
export type contentCryptId = Buffer;
export type publicKey = Buffer;
export type userId = string;
export type varchar_8 = string;
export type varchar_254 = string;
export type varchar_20 = string;

export interface User {
  readonly userId: userId | null,
  readonly publicKey: publicKey | null,
  readonly userName: userName | null,
  readonly email: email | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly credits: integer | null,
  readonly groups: userGroup[] | null
};

export interface UserLink {
  readonly user_A: userId | null,
  readonly user_B: userId | null,
  readonly tags: varchar_20[] | null,
  readonly created: created | null,
  readonly updated: updated | null
};

export interface Auth {
  readonly authProvider: authProvider | null,
  readonly authId: authId | null,
  readonly userId: userId | null,
  readonly created: created | null,
  readonly updated: updated | null
};

export interface Blob {
  readonly blobId: blobId | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly blobContent: binary | null
};

export interface Content {
  readonly contentId: contentId | null,
  readonly contentType: contentType | null,
  readonly userId: userId | null,
  readonly blobId: blobId | null,
  readonly content: content | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly mime_ext: varchar_8 | null,
  readonly title: varchar_254 | null,
  readonly tags: varchar_20[] | null,
  readonly cryptHash: binary | null,
  readonly published: timestamp | null
};

export interface Link {
  readonly linkId: linkId | null,
  readonly userId: userId | null,
  readonly linkDescription: linkDescription | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly url: urlString | null,
  readonly tags: varchar_20[] | null,
  readonly prevLink: linkId | null,
  readonly hitCount: integer | null,
  readonly amount: integer | null
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