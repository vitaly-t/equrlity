import * as React from "react";
import * as ReactDOM from "react-dom";

import { AppState, deserializeLinks } from "./AppState";
import { PopupPanel } from "./components/Popup";

function render(state_: any) {
  console.log("render called");
  let links = deserializeLinks(state_.links);  // stoopid Map can't be serialized...
  let state: AppState = {...state_, links};
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
  chrome.runtime.sendMessage({ eventType: "GetState" }, st => render(st) );
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.eventType === "Render") {
    render(message.appState);
  }
  else if (message.eventType === "RenderMessage") {
    renderServerMessage(message.msg);
  }
});