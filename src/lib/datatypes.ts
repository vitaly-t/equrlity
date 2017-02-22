// This file is generated - it should not be edited


export type authId = string;
export type authProvider = "ip" | "facebook" | "github" | "twitter" | "linkedin";
export type binary = ArrayBuffer;
export type contentId = number;
export type contentCryptId = ArrayBuffer;
export type contentType = "url" | "yt_video" | "text" | "mp3";
export type created = Date;
export type date = Date;
export type email = string;
export type integer = number;
export type json = string;
export type linkId = number;
export type linkDescription = string;
export type percentage = number;
export type publicKey = ArrayBuffer;
export type text = string;
export type timestamp = Date;
export type updated = Date;
export type userGroup = "admin" | "author" | "member";
export type urlString = string;
export type userName = string;
export type uuid = string;
export type userId = string;
export type content = string;

export interface User {
  readonly userId: userId | null,
  readonly publicKey: publicKey | null,
  readonly userName: userName | null,
  readonly email: email | null,
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

export interface Promotion {
  readonly linkId: linkId | null,
  readonly userId: userId | null,
  readonly created: created | null,
  readonly delivered: timestamp | null
};

export interface View {
  readonly userId: userId | null,
  readonly linkId: linkId | null,
  readonly created: created | null
};

// end of generated types