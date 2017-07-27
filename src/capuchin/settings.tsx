import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, IToaster, Position, Intent } from "@blueprintjs/core";
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { Row, Col } from 'react-simple-flex-grid';


import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/constants";
import * as Tags from '../lib/tags';
import { MarkdownEditor } from '../lib/markdownEditor';
import { YesNoBox } from '../lib/dialogs';
import { TagGroupEditor, TagSelectOption } from '../lib/tags';

import { AppState, postDeserialize, userNameFromId, userIdFromName } from "./AppState";
import { uploadRequest, sendApiRequest } from "../lib/axiosClient";
import * as Chrome from './chrome';
import { PanelContext } from './home';

interface SettingsPanelProps { appState: AppState, panelContext: PanelContext };
interface SettingsPanelState { user: Dbt.User };
export class SettingsPanel extends React.Component<SettingsPanelProps, SettingsPanelState> {

  constructor(props: SettingsPanelProps) {
    super(props);
    let { user } = this.props.appState;
    this.state = { user };
  }

  setUser(user: Dbt.User) {
    this.setState({ user });
  }

  changeUserName(userName) {
    this.setUser({ ...this.state.user, userName });
  }

  changeEmail(email) {
    this.setUser({ ...this.state.user, email });
  }

  changeHomePage(home_page) {
    this.setUser({ ...this.state.user, home_page });
  }

  changeInfo(info) {
    this.setUser({ ...this.state.user, info });
  }

  changeProfilePic(profile_pic) {
    this.setUser({ ...this.state.user, profile_pic });
  }

  changeSubscriptions(subscriptions) {
    this.setUser({ ...this.state.user, subscriptions });
  }

  changeBlacklist(blacklist) {
    this.setUser({ ...this.state.user, blacklist });
  }

  changeFollowing(labels) {
    let following = labels.map(l => userIdFromName(this.props.appState, l));
    this.setUser({ ...this.state.user, following });
  }

  componentWillReceiveProps(nextProps) {
    this.setUser(nextProps.appState.user);
  }

  isDirty(): boolean {
    let u = this.state.user;
    let p = this.props.appState.user;
    function isDiff(a, b) {
      if (!a && !b) return false;
      if (!a || !b) return true;
      if (a.length !== b.length) return true;
      return a.findIndex(e => b.indexOf(e) < 0) >= 0;
    }
    return u.userName !== p.userName || u.email !== p.email || u.home_page !== p.home_page || u.info !== p.info || u.profile_pic !== p.profile_pic
      || isDiff(u.subscriptions, p.subscriptions) || isDiff(u.blacklist, p.blacklist) || isDiff(u.following, p.following);
  }

  saveSettings = () => {
    console.log("saving settings");
    let settings = this.state.user;
    let errHndlr = (msg) => this.props.panelContext.toast.show({ message: "Error: " + msg });
    sendApiRequest("changeSettings", settings, errHndlr);

  }

  render() {
    let st = this.props.appState;
    let vsp = <div style={{ height: 20 }} />;
    let divStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let lhcolStyle = { marginBottom: "5px" };
    let user = this.state.user;
    let { userName, email, home_page, info, profile_pic, subscriptions, blacklist } = user;
    let following = user.following ? user.following.map(uid => userNameFromId(st, uid)) : [];

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
        <div className="pt-elevation-0" style={{ width: "100%", height: "100%", marginTop: 5, marginLeft: 5, padding: 6, backgroundColor: "#F5F8FA" }}>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Public Name: </div>
            <input type="text" style={{ width: '60%' }} name="NickName" id="nickId" value={userName || ''} onChange={(e) => this.changeUserName(e.target.value)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Email: </div>
            <input type="email" style={{ width: '60%' }} name="Email" id="emailId" value={email || ''} onChange={(e) => this.changeEmail(e.target.value)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >HomePage: </div>
            <input type="text" style={{ width: '60%' }} name="HomePage" id="homePageId" value={home_page || ''} onChange={(e) => this.changeHomePage(e.target.value)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Following: </div>
            <TagGroupEditor tags={following} tagClass="pt-intent-success pt-round pt-large" creatable={false} allTags={this.props.appState.userNames} onChange={(tags) => this.changeFollowing(tags)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Subscriptions: </div>
            <TagGroupEditor tags={subscriptions} creatable={false} allTags={this.props.appState.allTags} onChange={(tags) => this.changeSubscriptions(tags)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Blacklist: </div>
            <TagGroupEditor tags={blacklist} creatable={false} allTags={this.props.appState.allTags} onChange={(tags) => this.changeBlacklist(tags)} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Further Info: </div>
            <MarkdownEditor value={info} onChange={info => this.changeInfo(info)} allowHtml={true} />
          </div>
          <div style={divStyle}>
            <div className="pt-text-muted" style={lhcolStyle} >Profile Picture: </div>
            {profile_pic ? <div className="pt-elevation-2" style={divStyle}><img src={`${Utils.serverUrl}/user/${userName}/img`} /></div>
              : <p>You do not currently have a profile picture. To create one, upload an image from the content page, and then use the drop down menu of the
               image content item to select it as your profile picture.</p>}
            <div style={divStyle}>
              <Button className="pt-intent-primary" disabled={!this.isDirty()} onClick={this.saveSettings} text="Save Settings" />
            </div>
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
          <p>We respect your privacy. The information we store about you on our servers consists of an internally generated identifier, your nickname,
             your email address (if supplied) and your homepage (if supplied).  We retain your homepage to allow the system to present links in content pages, and also to
            automatically redirect visitors there as appropriate - eg. if they don&apos;t have the extension installed.
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

