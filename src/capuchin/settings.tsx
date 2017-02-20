import * as React from 'react';
import * as ReactDOM from "react-dom";

import { AppState, postDeserialize } from "./AppState";
import { sendGetUserLinks } from './Comms';

import { Url, format } from 'url';
import * as Rpc from '../lib/rpc'
import * as Utils from '../lib/utils';

interface SettingsPageProps { appState?: AppState };
interface SettingsPageState { nickName: string, email: string, deposit: number, links: Rpc.UserLinkItem[] };

export class SettingsPage extends React.Component<SettingsPageProps, SettingsPageState> {

  constructor(props) {
    super(props);
    this.state = { nickName: props.appState.moniker, email: '', deposit: 0, links: [] };
  }

  ctrls: { nickNameInput?: HTMLInputElement, emailInput?: HTMLInputElement, depositInput?: HTMLInputElement } = {}

  componentWillMount() {
    (async () => {
      console.log('fetching links');
      let response = await sendGetUserLinks(this.props.appState);
      let rsp: Rpc.Response = response.data;
      if (rsp.error) {
        // should do an alert here ...
        console.log("Server returned error for fetch links: " + rsp.error.message);
        return;
      }
      let rslt: Rpc.GetUserLinksResponse = rsp.result;
      let links = rslt.links;
      console.log('storing links');
      this.setState({ links });
    })();
  }

  changeNickName() {
    this.setState({ nickName: this.ctrls.nickNameInput.value });
  }

  changeEmail() {
    this.setState({ email: this.ctrls.emailInput.value });
  }

  changeDeposit() {
    this.setState({ deposit: parseInt(this.ctrls.depositInput.value) });
  }

  saveSettings = () => {
    console.log("saving settings");
    let settings: Rpc.ChangeSettingsRequest = { moniker: this.state.nickName, email: this.state.email, deposit: this.state.deposit };
    chrome.runtime.sendMessage({ eventType: "ChangeSettings", settings });
  }

  render() {
    return (<div>
      <h3>Your Settings:</h3>
      <div style={{ width: '100%', marginTop: 5, marginLeft: 5, padding: 6 }}>
        <div style={{ width: '20%' }} >NickName: </div>
        <input type="text" style={{ width: '60%' }} name="NickName" id="nickId" ref={(e) => this.ctrls.nickNameInput = e}
          value={this.state.nickName} onChange={(e) => this.changeNickName()} />
      </div>
      <div style={{ width: '100%', marginTop: 5, marginLeft: 5, padding: 6 }}>
        <div style={{ width: '20%' }} >Email: </div>
        <input type="email" style={{ width: '60%' }} name="Email" id="emailId" ref={(e) => this.ctrls.emailInput = e}
          value={this.state.email} onChange={(e) => this.changeEmail()} />
      </div>
      <div style={{ width: '100%', marginTop: 5, marginLeft: 5, padding: 6 }}>
        <div style={{ width: '20%' }} >Deposit: </div>
        <input type="number" style={{ width: 100 }} name="Deposit" id="depositId" ref={(e) => this.ctrls.depositInput = e}
          value={this.state.deposit} onChange={(e) => this.changeDeposit()} />
      </div>
      <div style={{ width: '100%', marginTop: 5, marginLeft: 5, padding: 6 }}>
        <button onClick={this.saveSettings} >Save Settings</button>
      </div>
    </div>);
  }
}

function render(state: AppState) {
  console.log("render called");
  let elem = document.getElementById('app')
  if (!elem) console.log("cannot get app element");
  else {
    ReactDOM.render(<SettingsPage appState={state} />, elem);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ eventType: "GetState" }, st => render(postDeserialize(st)));
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.eventType === "Render") {
    let state: AppState = postDeserialize(message.appState);
    render(state);
  }
});