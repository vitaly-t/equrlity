// This file is generated - it should not be edited


export type authId = string;
export type authProvider = "facebook" | "github" | "twitter" | "linkedin" | "chrome";
export type binary = Buffer;
export type contentType = "video" | "post" | "audio" | "image" | "link";
export type created = Date;
export type date = Date;
export type email = string;
export type integer = number;
export type ipAddress = string;
export type json = string;
export type hashId = string;
export type percentage = number;
export type tag = string;
export type text = string;
export type timestamp = Date;
export type title = string;
export type updated = Date;
export type userGroup = "admin" | "author" | "member";
export type urlString = string;
export type userName = string;
export type uuid = string;
export type content = string;
export type blobId = number;
export type blobContent = Buffer;
export type contentId = string;
export type contentCryptId = Buffer;
export type isPublic = boolean;
export type linkId = string;
export type publicKey = Buffer;
export type published = Date;
export type userId = string;
export type viewId = number;
export type varchar_8 = string;
export type varchar_200 = string;

export interface Tag {
  readonly tag: tag | null,
  readonly created: created | null
};

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
  readonly tags: tag[] | null,
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

export interface Content {
  readonly contentId: contentId | null,
  readonly contentType: contentType | null,
  readonly title: title | null,
  readonly userId: userId | null,
  readonly blobId: blobId | null,
  readonly content: content | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly published: published | null,
  readonly isPublic: isPublic | null,
  readonly url: urlString | null,
  readonly mime_ext: varchar_8 | null,
  readonly tags: tag[] | null,
  readonly cryptHash: varchar_200 | null
};

export interface Link {
  readonly linkId: linkId | null,
  readonly userId: userId | null,
  readonly contentId: contentId | null,
  readonly title: title | null,
  readonly created: created | null,
  readonly updated: updated | null,
  readonly comment: text | null,
  readonly url: urlString | null,
  readonly prevLink: linkId | null,
  readonly tags: tag[] | null,
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
  readonly viewId: viewId | null,
  readonly userId: userId | null,
  readonly linkId: linkId | null,
  readonly created: created | null
};

export interface ContentView {
  readonly viewId: viewId | null,
  readonly userId: userId | null,
  readonly contentId: contentId | null,
  readonly linkId: linkId | null,
  readonly ipAddress: ipAddress | null,
  readonly created: created | null
};

// end of generated types