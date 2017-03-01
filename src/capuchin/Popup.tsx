import * as React from 'react';
import { AppState, expandedUrl, isWaiting, getLinked } from "./AppState";
import { Url, format } from 'url';
import Form from 'react-input';
import * as Rpc from '../lib/rpc'
import { capuchinVersion, serverUrl } from '../lib/utils';

export interface PopupPanelProps { appState?: AppState; serverMessage?: string };
export interface PopupPanelState { amplifyAmount: number, description: string };

export class PopupPanel extends React.Component<PopupPanelProps, PopupPanelState> {

  constructor(props) {
    super(props);
    this.state = { amplifyAmount: 20, description: props.appState.activeUrl };
  }

  ctrls: { amountInput?: HTMLInputElement, descriptionInput?: HTMLInputElement } = {}

  changeAmplifyAmount() {
    this.setState({ amplifyAmount: parseInt(this.ctrls.amountInput.value) });
  }

  changeDescription() {
    this.setState({ description: this.ctrls.descriptionInput.value });
  }

  render() {
    let props = this.props;
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
    let versionDiv = (<p>Version: {capuchinVersion()}. Proudly brought to you by NotQuiteAsUglyAsOnceItWas Interfaces Ltd. (C) 2005. All rights reserved</p>);

    if (st.lastErrorMessage) return <div>Error: {st.lastErrorMessage}</div>
    let pnl = <div>No active URL found</div>
    if (curl) {
      let tgt = expandedUrl(st);
      let desc = this.state.description;
      console.log("rendering for target :" + tgt);
      let linkInfo = getLinked(st, curl);
      let lbl = linkInfo ? (linkInfo.linkAmplifier === st.moniker ? "Re-Invest" : "Re-Amplify") : "Amplify";
      let saveaction = () => {
        let amount = this.state.amplifyAmount;
        let linkDescription = this.state.description
        chrome.runtime.sendMessage({ eventType: "Save", amount, linkDescription, async: true });
      }
      let infoDiv = linkInfo ? <div>{`Amplified by: ${linkInfo.linkAmplifier}, Link depth : ${linkInfo.linkDepth}`}</div> : null;
      let costPerView = linkInfo ? linkInfo.linkDepth + 1 : 1;
      pnl = (<div>
        <p>Target : <textarea style={{ width: 450 }}>{tgt}</textarea></p>
        {infoDiv}
        <p>Investment amount: <input type="number" ref={(e) => this.ctrls.amountInput = e} max={st.ampCredits}
          value={this.state.amplifyAmount} onChange={(e) => this.changeAmplifyAmount()} /></p>
        <p>This will provide for a maximum of {Math.floor(this.state.amplifyAmount / costPerView)} promotions.</p>  
        <p>Description: <input type="string" style={{ width: 400 }} ref={(e) => this.ctrls.descriptionInput = e}
          value={desc} onChange={(e) => this.changeDescription()} /></p>
        <button onClick={saveaction} >{lbl}</button>
      </div>);
    }
    let settingsAction = () => chrome.runtime.sendMessage({ eventType: "LaunchSettingsPage", async: true });
    return <div>
      <p>Using Server Url: {serverUrl} </p>
      <p>Your Synereo Nickname is: {st.moniker}</p>
      <p>Your current Amp Balance is: {st.ampCredits}</p>
      <p><button onClick={settingsAction}>View/Edit Settings</button></p>
      {pnl}
      {versionDiv}
    </div>
  }
}
