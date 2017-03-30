

import { Message } from './Event';

export function sendMessage(msg: Message) {
  let m = { ...msg, async: true };
  chrome.runtime.sendMessage(m);
}

export function sendSyncMessage(msg: Message) {
  let m = { ...msg, async: false };
  chrome.runtime.sendMessage(m);
}

