import * as React from 'react';
import * as ReactDOM from "react-dom";
import * as Blueprint from "@blueprintjs/core";
import '@blueprintjs/core/dist/blueprint.css';

import { AppState, postDeserialize } from "./AppState";
import { sendGetUserLinks } from './Comms';

import { Url, format } from 'url';
import * as Rpc from '../lib/rpc'
import * as Utils from '../lib/utils';

interface SettingsPageProps { appState?: AppState };
interface SettingsPageState { nickName: string, email: string, deposit: number };

export class SettingsPage extends React.Component<SettingsPageProps, SettingsPageState> {

  constructor(props) {
    super(props);
    this.state = { nickName: props.appState.moniker, email: '', deposit: 0 };
  }

  ctrls: { nickNameInput?: HTMLInputElement, emailInput?: HTMLInputElement, depositInput?: HTMLInputElement } = {}

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
    this.setState({ deposit: 0 });
  }

  render() {
    let st = this.props.appState;
    let invs = st.investments;
    let invrows = invs.map(l => {
      let linkId = l.linkId;
      let url = l.contentUrl;
      let redeem = () => { chrome.runtime.sendMessage({ eventType: "RedeemLink", linkId, async: true }); };
      let onclick = () => { chrome.tabs.create({ active: true, url }); };

      return (
        <tr key={l.linkId} >
          <td><button onClick={redeem}>Redeem</button></td>
          <td><a href="" onClick={onclick} >{url}</a></td>
          <td>{l.linkDepth}</td>
          <td>{l.promotionsCount}</td>
          <td>{l.deliveriesCount}</td>
          <td>{l.viewCount}</td>
          <td>{l.amount}</td>
        </tr>
      );
    });

    let links = st.promotions;
    let linkrows = links.map(url => {
      let dismiss = () => { chrome.runtime.sendMessage({ eventType: "DismissPromotion", url }); };
      let onclick = () => { chrome.tabs.create({ active: true, url }); };
      let [tgt, desc] = url.split('#');
      if (desc) desc = desc.replace('_', ' ');
      return (
        <tr key={url} >
          <td><button onClick={dismiss}>Dismiss</button></td>
          <td><a href="" onClick={onclick} >{tgt}</a></td>
          <td>{desc}</td>
        </tr>
      );
    });

    let vsp = <div style={{ height: 20 }} />;

    return (
      <div>
        <h3>Synereo Amplitude Settings</h3>
        {vsp}
        <h5>Your Settings:</h5>
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
          <button type="button" className="pt-intent-primary" onClick={this.saveSettings} >Save Settings</button>
        </div>
        {vsp}
        <div>
          <h4>Investments : </h4>
          {vsp}
          <h6>Your Current Wallet Balance is : {st.ampCredits}.</h6>
          {vsp}
          <table className="pt-table pt-striped pt-bordered" >
            <thead>
              <tr>
                <th></th>
                <th>Content</th>
                <th>Depth</th>
                <th>Amplifications</th>
                <th>Deliveries</th>
                <th>Views</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {invrows}
            </tbody>
          </table>
        </div>
        {vsp}
        <div>
          <h4>Amplified Links for you : </h4>
          {vsp}
          <table className="pt-table pt-striped pt-bordered">
            <thead>
              <tr>
                <th></th>
                <th>Link</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {linkrows}
            </tbody>
          </table>
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