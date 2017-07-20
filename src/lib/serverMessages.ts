// the server just sends stuff and assumes the client processes it ok

import * as Dbt from './datatypes';
import * as Rpc from './rpc';

export type ServerMessageType = "Init" | "Feed" | "Content" | "Link" | "Tag"

export type MessageHeaders = {
  credits: Dbt.integer;
  moniker: Dbt.userName;
  email: Dbt.email;
  //authprov: Dbt.authProvider;
  homePage: Dbt.urlString;
  timeStamp: string;
}

export type MessageItem = {
  type: ServerMessageType,
  message: any,
  remove?: boolean
}

export type ServerMessage = {
  headers: MessageHeaders,
  messages: MessageItem[]
}

