import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppState, postDeserialize } from "./AppState";
import { PopupPanel } from "./Popup";

function render(state: AppState) {
  console.log("render called");
  let elem = document.getElementById('app')
  let url = state.activeUrl;
  if (!elem) console.log("cannot get app element");
  else {
    ReactDOM.render(<PopupPanel appState={state} />, elem);
  }
}

function renderServerMessage(msg: string) {
  console.log("renderServerMessage called");
  let elem = document.getElementById('app')
  if (!elem) console.log("cannot get app element");
  else {
    ReactDOM.render(<PopupPanel serverMessage={msg} />, elem);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ eventType: "GetState" }, st => render(postDeserialize(st)) );
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.eventType === "Render") {
    let state: AppState = postDeserialize(message.appState);
    render(state);
  }
  else if (message.eventType === "RenderMessage") {
    renderServerMessage(message.msg);
  }
});