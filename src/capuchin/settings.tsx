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
import { MarkdownEditor } from '../lib/markdownEditor';
import { YesNoBox } from '../lib/dialogs';
import { TagGroupEditor, TagSelectOption } from '../lib/tags';

import { AppState, postDeserialize } from "./AppState";
import { uploadRequest, sendApiRequest } from "../lib/axiosClient";
import * as Chrome from './chrome';


interface SettingsPageProps { appState: AppState };
interface SettingsPageState { settings: Rpc.UserSettings, prevSettings: Rpc.UserSettings, allUsers: TagSelectOption[] };
export class SettingsPage extends React.Component<SettingsPageProps, SettingsPageState> {

  constructor(props: SettingsPageProps) {
    super(props);
    let settings: Rpc.UserSettings = {
      userName: props.appState.moniker, email: props.appState.email, homePage: '', info: '', profile_pic: '',
      subscriptions: [], blacklist: [], following: []
    };
    this.state = { settings, prevSettings: settings, allUsers: [] };
  }

  fetchUserSettings = async () => {
    let response = await sendApiRequest("getUserSettings", {});
    let rsp: Rpc.Response = response.data;
    if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
    let settings: Rpc.UserSettings = rsp.result;
    let allUsers = settings.allUsers.map(u => { return { value: u, label: u }; });
    this.setState({ settings, prevSettings: settings, allUsers });
  }

  componentDidMount() {
    this.fetchUserSettings();
  }

  changeUserName(userName) {
    let settings = { ...this.state.settings, userName }
    this.setState({ settings });
  }

  changeEmail(email) {
    let settings = { ...this.state.settings, email }
    this.setState({ settings });
  }

  changeHomePage(homePage) {
    let settings = { ...this.state.settings, homePage }
    this.setState({ settings });
  }

  changeInfo(info) {
    let settings = { ...this.state.settings, info }
    this.setState({ settings });
  }

  changeProfilePic(profile_pic) {
    let settings = { ...this.state.settings, profile_pic }
    this.setState({ settings });
  }

  changeSubscriptions(subscriptions) {
    let settings = { ...this.state.settings, subscriptions }
    this.setState({ settings });
  }

  changeBlacklist(blacklist) {
    let settings = { ...this.state.settings, blacklist }
    this.setState({ settings });
  }

  changeFollowing(following) {
    let settings = { ...this.state.settings, following }
    this.setState({ settings });
  }

  isDirty(): boolean {
    let { userName, email, homePage, info, profile_pic, subscriptions, blacklist, following } = this.state.settings;
    let p = this.state.prevSettings;
    return userName !== p.userName || email !== p.email || homePage !== p.homePage || info !== p.info
      || profile_pic !== p.profile_pic || subscriptions !== p.subscriptions || blacklist !== p.blacklist || following !== p.following;
  }

  saveSettings = () => {
    console.log("saving settings");
    let settings = this.state.settings;
    this.setState({ prevSettings: settings });
    Chrome.sendMessage({ eventType: "ChangeSettings", settings });
  }

  render() {
    let st = this.props.appState;
    let userNames = st.connectedUsers;
    let vsp = <div style={{ height: 20 }} />;
    let divStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let lhcolStyle = { marginBottom: "5px" };
    let { userName, email, homePage, info, profile_pic } = this.state.settings;

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
        <h4>Your Settings:</h4>
        <div className="pt-elevation-0" style={{ width: "100%", height: "100%", marginTop: 5, marginLeft: 5, padding: 6, backgroundColor: "#F5F8FA" }}>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Public Name: </div>
            <input type="text" style={{ width: '60%' }} name="NickName" id="nickId" value={userName} onChange={(e) => this.changeUserName(e.target.value)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Email: </div>
            <input type="email" style={{ width: '60%' }} name="Email" id="emailId" value={email} onChange={(e) => this.changeEmail(e.target.value)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >HomePage: </div>
            <input type="text" style={{ width: '60%' }} name="HomePage" id="homePageId" value={homePage} onChange={(e) => this.changeHomePage(e.target.value)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Following: </div>
            <TagGroupEditor tags={this.state.settings.following} tagClass="pt-intent-success pt-round pt-large" creatable={false} allTags={this.state.allUsers} onChange={(tags) => this.changeFollowing(tags)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Subscriptions: </div>
            <TagGroupEditor tags={this.state.settings.subscriptions} creatable={false} allTags={this.props.appState.allTags} onChange={(tags) => this.changeSubscriptions(tags)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Blacklist: </div>
            <TagGroupEditor tags={this.state.settings.blacklist} creatable={false} allTags={this.props.appState.allTags} onChange={(tags) => this.changeBlacklist(tags)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Further Info: </div>
            <MarkdownEditor value={info} onChange={info => this.changeInfo(info)} allowHtml={true} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Profile Picture: </div>
            <input type="text" style={{ width: '60%' }} name="ProfilePic" id="profilePicId" value={profile_pic} onChange={(e) => this.changeProfilePic(e.target.value)} />
          </div>
          {profile_pic && <div className="pt-elevation-2" style={divStyle}><img src={`${Utils.serverUrl}/user/${userName}/img`} /></div>}
          <div style={divStyle}>
            <Button className="pt-intent-primary" disabled={!this.isDirty()} onClick={this.saveSettings} text="Save Settings" />
          </div>
        </div>
        {vsp}
        <h4>Current status.</h4>
        <div style={divStyle}>
          <p>Using server URL: {Utils.serverUrl}.</p>
          <p>Version: {Utils.capuchinVersion()}. </p>
          {/*userp*/}
          {/*authdiv*/}
        </div>
        {vsp}
        <h4>Privacy Policy.</h4>
        <div style={divStyle}>
          <p>To ensure your privacy, we do not store any information whatsoever about your account on our servers, other than an internally generated identifier,
            your nickname, and your homepage (should you choose to provide one).  We retain your homepage to allow the system to present links in content pages, and also to
            automatically redirect visitors there as appropriate - eg. if they don&apos;t have the extension installed.</p>
          <p>We use web standard JWTs (Javascript Web Token - see <a href="https://jwt.io" target="_blank">https://jwt.io)</a>) to store any and all other identifying information inside your web browser's local storage, and ensure that
            it never appears on disk on our servers. This means that
            it is simply impossible for anybody hacking our servers to gain access to any information about you personally.  Nor can we ever be coerced by
            any legal authority whatsoever to provide information which we simply do not have access to.
          </p>
          <p>We do not use passwords at all.  </p>
          <p>For the time being the only client available is the Chrome browser extension, which can only be made available through the Google Store.
            We therefore rely on your Google identity, given that it is implicitly required to obtain the extension in the first place.
            In the future we may provide standard "Social Login" functionality for other providers (Keybase, Facebook, GitHub, Twitter, LinkedIn etc)
            to allow for independant establishment of your identity, and the sharing of accounts across multiple devices based on that established identity.</p>
        </div>
      </div>);
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

