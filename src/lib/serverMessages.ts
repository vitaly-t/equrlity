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

