import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent } from "@blueprintjs/core";
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { Row, Col } from 'react-simple-flex-grid';


import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Tags from '../lib/tags';

import { YesNoBox } from '../lib/dialogs';
import { AppState, postDeserialize } from "./AppState";
import { uploadRequest } from "./Comms";
import * as Chrome from './chrome';


interface SettingsPageProps { appState: AppState };
interface SettingsPageState { nickName: string, email: string };
export class SettingsPage extends React.Component<SettingsPageProps, SettingsPageState> {

  constructor(props) {
    super(props);
    console.log("email received: " + props.appState.email);
    this.state = { nickName: props.appState.moniker, email: props.appState.email };
  }

  ctrls: {
    nickNameInput?: HTMLInputElement, emailInput?: HTMLInputElement
  } = {}

  changeNickName() { this.setState({ nickName: this.ctrls.nickNameInput.value }); }
  changeEmail() { this.setState({ email: this.ctrls.emailInput.value }); }

  saveSettings = () => {
    console.log("saving settings");
    let settings: Rpc.ChangeSettingsRequest = { userName: this.state.nickName, email: this.state.email };
    Chrome.sendMessage({ eventType: "ChangeSettings", settings });
  }

  render() {
    let st = this.props.appState;
    let userNames = st.connectedUsers;
    let vsp = <div style={{ height: 20 }} />;
    let divStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let lhcolStyle = { width: '20%' };

    let userp = userNames.length > 0 ? <div><p>You are currently directly connected with another {userNames.length} user{userNames.length > 1 ? "s" : ""}.</p>
      <p>Your social graph currently extends to {st.reachableUserCount} reachable users.</p>
    </div>
      : <p>You are not currently connected with any other users. Hence, no promotions can be issued on your behalf.</p>;

    /*
        let authdiv = <p>You are currently authenticated via {st.authprov}</p>;
        if (!st.authprov) {
          let authClick = (provider) => {
            let req: Rpc.AuthenticateRequest = { provider };
            Chrome.sendMessage({ eventType: "Authenticate", req });
          }
          let root = Utils.serverUrl + "/auth";
          authdiv = (
            <div>
              <p>You are not currently authenticated.</p>
              <p>You can authenticate via:</p>
              <ul>
                <li><a href="" onClick={() => authClick('facebook')} >Facebook</a></li>
                <li><a href="" onClick={() => authClick('twitter')} >Twitter</a></li>
                <li><a href="" onClick={() => authClick('github')} >GitHub</a></li>
                <li><a href="" onClick={() => authClick('google')} >Google</a></li>
              </ul>
            </div>
          )
        };
    */

    return (
      <div>
        <h3>Status and Settings.</h3>
        <div style={divStyle}>
          <p>Using Server Url: {Utils.serverUrl}. Version: {Utils.capuchinVersion()} </p>
          {userp}
          {/*authdiv*/}
        </div>
        {vsp}
        <h5>Your Settings:</h5>
        <div style={divStyle}>
          <p>To ensure your privacy, we do not store any information whatsoever about your account on our servers, other than an internally generated identifier
            and your  nickname.
            We use web standard JWTs (Javascript Web Token - see <a href="https://jwt.io" target="_blank">https://jwt.io)</a>) to store any and all other identifying information inside your web browser's local storage, and ensure that
            it never appears on disk on our servers. This means that
            it is simply impossible for anybody hacking our servers to gain access to any information about you personally.  Nor can we ever be coerced by
            any legal authority whatsoever to provide information which we simply do not have access to.
          </p>
          <p>We do not use passwords at all.  In the future we intend to provide standard "Social Login" functionality (Keybase, Facebook, GitHub, Twitter, Google, LinkedIn etc)
            to allow for independant establishment of your identity, and the sharing of accounts across multiple devices based on that established identity.</p>
        </div>
        <div style={divStyle}>
          <div style={lhcolStyle} >Nickname: </div>
          <input type="text" style={{ width: '60%' }} name="NickName" id="nickId" ref={(e) => this.ctrls.nickNameInput = e}
            value={this.state.nickName} onChange={(e) => this.changeNickName()} />
        </div>
        <div style={divStyle}>
          <div style={lhcolStyle} >Email: </div>
          <input type="email" style={{ width: '60%' }} name="Email" id="emailId" ref={(e) => this.ctrls.emailInput = e}
            value={this.state.email} onChange={(e) => this.changeEmail()} />
        </div>
        <div style={divStyle}>
          <Button className="pt-intent-primary" onClick={this.saveSettings} text="Save Settings" />
        </div>
      </div>);
  }
}

interface PublishContentProps { info: Dbt.Content, allTags: Tags.TagSelectOption[], onClose: () => void }
interface PublishContentState { title: string, comment: string, tags: string[], isOpen: boolean, amount: number }
export class PublishContent extends React.Component<PublishContentProps, PublishContentState> {
  constructor(props: PublishContentProps) {
    super(props);
    let tags = props.info.tags || [];
    this.state = { isOpen: true, amount: 10, title: props.info.title, tags, comment: '' };
  }

  ctrls: {
    title: HTMLInputElement,
    tags: HTMLInputElement,
    comment: HTMLInputElement,
    investment: HTMLInputElement,
  } = { title: null, tags: null, comment: null, investment: null };

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeTags(e) { this.setState({ tags: e.target.value }); }
  changeComment(e) { this.setState({ comment: e.target.value }); }
  changeInvestment(e) { this.setState({ amount: parseInt(e.target.value) }); }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  save() {
    let { title, tags, amount, comment } = this.state;
    let info = this.props.info;
    let req: Rpc.PromoteContentRequest = { contentId: info.contentId, title, comment, tags, amount, signature: '' };
    Chrome.sendMessage({ eventType: "PromoteContent", req });
    this.close();
  }

  public render() {
    if (!this.state.isOpen) return null;
    let pubdiv = null;
    let ttl = "Promote Content"
    return (
      <Dialog iconName="inbox" isOpen={this.state.isOpen} title={ttl} onClose={() => this.close()} >
        <div className="pt-dialog-body">
          <div style={rowStyle} >
            <div style={lhcolStyle}>Title:</div>
            <input type="text" style={{ marginTop: 6, height: "30px", width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Comment:</div>
            <input type="text" style={{ marginTop: 6, height: "30px", width: '100%' }} ref={(e) => this.ctrls.comment = e} value={this.state.comment} onChange={e => this.changeComment(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Tags:</div>
            <Tags.TagGroupEditor tags={this.state.tags} allTags={this.props.allTags} onChange={(tags) => this.changeTags(tags)} />
          </div>
          <div style={rowStyle} >
            <div style={{ display: 'inline' }}>Investment amount:</div>
            <input type="number" style={{ display: 'inline', height: "24px", marginTop: "6px", width: '100px' }} ref={(e) => this.ctrls.investment = e} value={this.state.amount} onChange={e => this.changeInvestment(e)} />
          </div>
        </div>
        <div className="pt-dialog-footer">
          <div className="pt-dialog-footer-actions">
            <Button text="Cancel" onClick={() => this.close()} />
            <Button intent={Intent.PRIMARY} onClick={() => this.save()} text="Publish" />
          </div>
        </div>
      </Dialog >
    );
  }
}

function render(state: AppState) {
  //console.log("render called for settings");
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

