// This file is generated - it should not be edited


export type authId = string;
export type binary = ArrayBuffer;
export type contentId = number;
export type contentCryptId = ArrayBuffer;
export type contentType = "url" | "yt_video" | "text" | "mp3";
export type date = Date;
export type integer = number;
export type json = string;
export type linkId = number;
export type percentage = number;
export type text = string;
export type timestamp = Date;
export type userGroup = "admin" | "author" | "member";
export type userId = ArrayBuffer;
export type userName = string;
export type uuid = string;

export interface Auth {
  readonly authId: authId | null,
  readonly userId: userId | null,
  readonly created: timestamp | null,
  readonly updated: timestamp | null
};

export interface Content {
  readonly contentId: contentId | null,
  readonly cryptHash: binary | null,
  readonly amplifierId: userId | null,
  readonly content: text | null
};

export interface Link {
  readonly linkId: linkId | null,
  readonly amplifierId: userId | null,
  readonly contentId: contentId | null,
  readonly prevLink: linkId | null,
  readonly hitCount: integer | null
};

export interface User {
  readonly userId: userId | null,
  readonly created: timestamp | null,
  readonly updated: timestamp | null,
  readonly userName: userName | null,
  readonly groups: userGroup[] | null
};

// end of generated types