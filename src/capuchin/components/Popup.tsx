import * as React from 'react';
import { AppState, expandedUrl, isWaiting, isLinked } from "../AppState";
import { Url, format } from 'url';
import { serverUrl } from '../Comms';
import Form from 'react-input';
import * as Rpc from '../../lib/rpc'

export interface PopupPanelProps { appState?: AppState; serverMessage?: string };
export interface PopupPanelState { amplifyAmount: number };

export class PopupPanel extends React.Component<PopupPanelProps, PopupPanelState> {

  constructor(props) {
    super(props);
    this.state = { amplifyAmount: 20 };
  }

  ctrls: { amountInput?: HTMLInputElement } = {}

  changeAmplifyAmount() {
    this.setState({amplifyAmount: parseInt(this.ctrls.amountInput.value) });
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
        let pnl = st.lastErrorMessage ?  <div>Error: {st.lastErrorMessage}</div> : <div>No active URL found</div>
        if (curl) {
          let tgt = expandedUrl(st);
          console.log("rendering for target :" + tgt);

          let lbl = isLinked(st, curl) ? "Re-Amplify" : "Amplify";
          let saveaction = () => {
            let amount = this.state.amplifyAmount;
            chrome.runtime.sendMessage({ eventType: "Save", amount, async: true });
          }
          pnl = (<div>
            <p>Target : {tgt}</p>
            <p>Investment amount: <input type="number" ref={(e) => this.ctrls.amountInput = e} max={st.ampCredits}
                                value={this.state.amplifyAmount} onChange={(e) => this.changeAmplifyAmount() } /></p>
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
          <p>This form brought to you by UglyAsF*ck Enterprises.  All rights reserved</p>
        </div>;

      }
    }
  }
}
