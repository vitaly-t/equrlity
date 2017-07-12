// the server just sends stuff and assumes the client processes it ok

import * as Dbt from './datatypes';
import * as Rpc from './rpc';

export type MessageType = "Feed" | "Content" | "Tag" | "Comment" | "Link"

export type Message = {
  type: MessageType,
  message: any,
  remove?: boolean
}

