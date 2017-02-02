// This file is generated - it should not be edited


export type authId = string;
export type contentId = ArrayBuffer;
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
  readonly authId?: authId,
  readonly userId?: userId,
  readonly created?: timestamp,
  readonly updated?: timestamp
};

export interface Content {
  readonly id?: contentId,
  readonly amplifierId?: userId,
  readonly content?: text
};

export interface Links {
  readonly linkId?: linkId,
  readonly amplifierId?: userId,
  readonly contentId?: contentId,
  readonly prevLink?: linkId,
  readonly hitCount?: integer
};

export interface User {
  readonly userId?: userId,
  readonly created?: timestamp,
  readonly updated?: timestamp,
  readonly userName?: userName,
  readonly groups?: userGroup[]
};

// end of generated types