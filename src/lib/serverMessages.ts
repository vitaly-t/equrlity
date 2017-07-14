// the server just sends stuff and assumes the client processes it ok

import * as Dbt from './datatypes';
import * as Rpc from './rpc';

export type MessageType = "Feed" | "Content" | "Link"

export type MessageHeaders = {
  credits: Dbt.integer,
  moniker: Dbt.userName,
  email: Dbt.email,
  //authprov: Dbt.authProvider,
  homePage: Dbt.urlString
}

export type Message = {
  type: MessageType,
  message: any,
  remove?: boolean
}

export type ServerMessage = {
  headers: MessageHeaders,
  messages: Message[]
}
