import * as React from 'react';
import { AppState, expandedUrl, isWaiting, isLinked } from "../AppState";
import { Url, format } from 'url';
import { SaveButton } from "./SaveButton";
import { serverUrl } from '../Comms';

export interface PopupPanelProps { appState?: AppState; serverMessage?: string };

export const PopupPanel = (props: PopupPanelProps) => {
  if (props.serverMessage) {
    console.log("rendering server message...");
    return <div>Server error: {props.serverMessage} </div>;
  }
  let st = props.appState;
  let curl = st.activeUrl
  if (curl && isWaiting(st, curl)) {
    console.log("rendering waiting for response...");
    return <div>Waiting for response from Server</div>;
  }
  console.log("rendering popup...");
  let pnl = <div>Internal error - no active URL found</div>
  if (curl) {
    let tgt = expandedUrl(st);
    console.log("rendering for target :" + tgt);
    
    let lbl = isLinked(st, curl) ? "Re-Amplify" : "Amplify";
    let amount = 20;  // need to receive this from the UI
    let action = () => chrome.runtime.sendMessage({ eventType: "Save", amount, async: true });
    pnl = (<div>
      <p>Investment amount: {amount} </p>
      <p>Target : {tgt}</p>
      <SaveButton action={action} label={lbl} />
      <p>Using Server Url: {serverUrl} </p>
    </div>);
  }
  return <div>
    <p>Your Synereo Moniker is: {st.moniker}</p>
    <p>Your current Amp Balance is: {st.ampCredits}</p>
    {pnl}
  </div>
}
