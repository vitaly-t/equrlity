import * as React from 'react';
import { AppState, expandedUrl, isWaiting, getLinked } from "../AppState";
import { Url, format } from 'url';
import { serverUrl } from '../Comms';
import Form from 'react-input';
import * as Rpc from '../../lib/rpc'

export interface PopupPanelProps { appState?: AppState; serverMessage?: string };
export interface PopupPanelState { amplifyAmount: number, description: string };

export class PopupPanel extends React.Component<PopupPanelProps, PopupPanelState> {

  constructor(props) {
    super(props);
    this.state = { amplifyAmount: 20, description: '' };
  }

  ctrls: { amountInput?: HTMLInputElement, descriptionInput?: HTMLInputElement } = {}

  changeAmplifyAmount() {
    this.setState({amplifyAmount: parseInt(this.ctrls.amountInput.value) });
  }

  changeDescription() {
    this.setState({description: this.ctrls.descriptionInput.value });
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
    switch (st.mode) {
      case "Amplify": {
        if (st.lastErrorMessage) return  <div>Error: {st.lastErrorMessage}</div>
        let pnl = <div>No active URL found</div>
        if (curl) {
          let tgt = expandedUrl(st);
          console.log("rendering for target :" + tgt);
          let linkInfo = getLinked(st, curl);
          let lbl = linkInfo ? "Re-Amplify" : "Amplify";
          let saveaction = () => {
            let amount = this.state.amplifyAmount;
            let linkDescription = this.state.description
            chrome.runtime.sendMessage({ eventType: "Save", amount, linkDescription, async: true });
          }
          let infoDiv = linkInfo ? <div>{ `Amplified by: ${linkInfo.linkAmplifier}, Link depth : ${linkInfo.linkDepth}` }</div> : null;
          pnl = (<div>
            <p>Target : {tgt}</p>
            {infoDiv}
            <p>Investment amount: <input type="number" ref={(e) => this.ctrls.amountInput = e} max={st.ampCredits}
                                value={this.state.amplifyAmount} onChange={(e) => this.changeAmplifyAmount() } /></p>
            <p>Description: <input type="string" ref={(e) => this.ctrls.descriptionInput = e} 
                                value={this.state.description} onChange={(e) => this.changeDescription() } /></p>
            <button onClick={saveaction} >{lbl}</button>
          </div>);
        }
        let settingsAction = () => chrome.runtime.sendMessage({ eventType: "SetMode", mode: "Settings" });
        return <div>
          <p>Using Server Url: {serverUrl} </p>
          <p>Your Synereo Nickname is: {st.moniker}</p>
          <p>Your current Amp Balance is: {st.ampCredits}</p>
          <p><button onClick={settingsAction}>Change Settings</button></p>
          {pnl}
          <p>This panel brought to you by UglyAsF*ck Interfaces Ltd. (C) 1996. All rights reserved</p>
        </div>
      }
      case "Settings": {
        let cancelAction = () => chrome.runtime.sendMessage({ eventType: "SetMode", mode: "Amplify" });
        let frm = (<Form
          fields={[
            { name: 'Nickname', key: 'moniker', type: 'text', required: false, placeholder: st.moniker },
            { name: 'Deposit', key: 'deposit', type: 'number', max: '1000', step: '10', required: false },
            { name: 'Email', key: 'email', type: 'email', required: false }
          ]}
          onSubmit={(settings: Rpc.ChangeSettingsRequest) => {
            console.log("onSubmit fired");
            chrome.runtime.sendMessage({ eventType: "ChangeSettings", settings });

          }}
        />)
        return <div>
          <h3>Your Settings:</h3>
          {frm}
          <button onClick={cancelAction}>Abandon Changes</button>
          <p>This form brought to you by UglyAsF*ck Interfaces Ltd. (C) 1996. All rights reserved</p>
        </div>;

      }
    }
  }
}
