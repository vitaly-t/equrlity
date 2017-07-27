// the server just sends stuff and assumes the client processes it ok

import * as Dbt from './datatypes';
import * as Rpc from './rpc';

export type ServerMessageType = "Init" | "Feed" | "Content" | "Link" | "Tag" | "User" | "UserIdName" | "Error"

export type MessageItem = {
  type: ServerMessageType,
  message: any,
  remove?: boolean
}

export type ServerMessage = {
  messages: MessageItem[]
}

export type UserIdName = {
  id: Dbt.userId;
  name: Dbt.userName;
}

export type FeedItem = {
  type: "share" | "comment";
  id: string;
  created: Dbt.timestamp;
  source: Dbt.userName;
  url: Dbt.urlString;
  tags: Dbt.tags;
  comment: string;
}

export type InitializeResponse = {
  user: Dbt.User;
  userNames: UserIdName[];
  feeds: FeedItem[];
  contents: Dbt.Content[];
  shares: Rpc.UserLinkItem[];
  allTags: Dbt.tag[];   // temporary (hopefully)
}

