import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button } from "@blueprintjs/core";
import * as Dropzone from 'react-dropzone';
import { Url, format } from 'url';

import * as Rpc from '../lib/rpc'
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';

import { YesNoBox } from './dialogs';
import { AppState, postDeserialize } from "./AppState";
import { sendGetUserLinks } from './Comms';


interface SettingsPageProps { appState?: AppState };
interface SettingsPageState { nickName: string, email: string, confirmDeletePost?: Rpc.PostInfoItem, transferAmount: number, transferTo: string };

export class SettingsPage extends React.Component<SettingsPageProps, SettingsPageState> {

  constructor(props) {
    super(props);
    console.log("email received: " + props.appState.email);
    this.state = { nickName: props.appState.moniker, email: props.appState.email, transferAmount: 0, transferTo: '' };
  }

  ctrls: {
    nickNameInput?: HTMLInputElement, emailInput?: HTMLInputElement, depositInput?: HTMLInputElement,
    transferAmount?: HTMLInputElement, transferTo?: HTMLInputElement
  } = {}

  changeNickName() { this.setState({ nickName: this.ctrls.nickNameInput.value }); }
  changeEmail() { this.setState({ email: this.ctrls.emailInput.value }); }
  changeTransferAmount() { this.setState({ transferAmount: parseInt(this.ctrls.transferAmount.value) }); }
  changeTransferTo() { this.setState({ transferTo: this.ctrls.transferTo.value }); }

  saveSettings = () => {
    console.log("saving settings");
    let settings: Rpc.ChangeSettingsRequest = { userName: this.state.nickName, email: this.state.email };
    chrome.runtime.sendMessage({ eventType: "ChangeSettings", settings, async: true });
  }

  onDropVideos(acceptedFiles, rejectedFiles) {
    console.log('Accepted files: ', acceptedFiles);
    console.log('Rejected files: ', rejectedFiles);
  }

  onDropAudios(acceptedFiles, rejectedFiles) {
    console.log('Accepted files: ', acceptedFiles);
    console.log('Rejected files: ', rejectedFiles);
  }

  render() {
    let st = this.props.appState;
    let invs = st.investments;
    let userNames = st.connectedUsers;
    let invdiv = <p>You have no current investments</p>
    if (invs.length > 0) {
      let invrows = invs.map(l => {
        let linkId = l.linkId;
        let url = l.contentUrl;
        let redeem = () => { chrome.runtime.sendMessage({ eventType: "RedeemLink", linkId, async: true }); };
        let onclick = () => { chrome.tabs.create({ active: true, url }); };

        return (
          <tr key={l.linkId} >
            <td><Button onClick={redeem}>Redeem</Button></td>
            <td><a href="" onClick={onclick} >{url}</a></td>
            <td>{l.linkDepth}</td>
            <td>{l.promotionsCount}</td>
            <td>{l.deliveriesCount}</td>
            <td>{l.viewCount}</td>
            <td>{l.amount}</td>
          </tr>
        );
      });
      invdiv = (
        <table className="pt-table pt-striped pt-bordered" >
          <thead>
            <tr>
              <th></th>
              <th>Content</th>
              <th>Depth</th>
              <th>Promotions</th>
              <th>Deliveries</th>
              <th>Views</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {invrows}
          </tbody>
        </table>
      );
    }

    let postsdiv = <p>You do not currently have any uploaded posts.</p>
    if (this.state.confirmDeletePost) {
      let msg = "Warning: Deleting a Post is irreversible. Are you sure you wish to Proceed?";
      let onClose = () => this.setState({ confirmDeletePost: null });
      let postId = this.state.confirmDeletePost.postId;
      let onYes = () => chrome.runtime.sendMessage({ eventType: "RemovePost", postId, async: true });
      postsdiv = <YesNoBox message={msg} onYes={onYes} onClose={onClose} />
    }
    else if (st.posts.length > 0) {
      let postrows = st.posts.map(p => {
        let onclick = () => { chrome.tabs.create({ active: true, url: p.contentUrl }); };
        let created = p.created ? OxiDate.toFormat(new Date(p.created), "DDDD, MMMM D @ HH:MIP") : '';
        let updated = p.updated ? OxiDate.toFormat(new Date(p.updated), "DDDD, MMMM D @ HH:MIP") : '';
        let published = p.published ? OxiDate.toFormat(new Date(p.updated), "DDDD, MMMM D @ HH:MIP") : '';

        let edit = () => { chrome.runtime.sendMessage({ eventType: "LaunchPostEditPage", post: p }); };
        let remove = () => { this.setState({ confirmDeletePost: p }) };
        return (
          <tr key={p.postId} >
            <td><Button onClick={edit} text="Edit" /></td>
            <td><Button onClick={remove} text="Delete" /></td>
            <td><a href="" onClick={onclick} >{p.contentUrl}</a></td>
            <td>{p.title}</td>
            <td>{created}</td>
            <td>{updated}</td>
            <td>{published}</td>
            <td>{p.tags}</td>
          </tr>
        );
      });
      postsdiv = (
        <table className="pt-table pt-striped pt-bordered" >
          <thead>
            <tr>
              <th></th>
              <th></th>
              <th>Content</th>
              <th>Title</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Published</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {postrows}
          </tbody>
        </table>);
    }
    let vidsdiv = <p>You do not currently have any uploaded videos.</p>
    let audsdiv = <p>You do not currently have any uploaded audios.</p>

    let links = st.promotions;
    let linkdiv = <p>There are no new promoted links for you.</p>
    if (links.length > 0) {
      let linkrows = links.map(url => {
        let dismiss = () => { chrome.runtime.sendMessage({ eventType: "DismissPromotion", url }); };
        let onclick = () => { chrome.tabs.create({ active: true, url }); };
        let [tgt, desc] = url.split('#');
        if (desc) desc = desc.replace('_', ' ');
        return (
          <tr key={url} >
            <td><Button onClick={dismiss} text="Dismiss" /></td>
            <td><a href="" onClick={onclick} >{tgt}</a></td>
            <td>{desc}</td>
          </tr>
        );
      });
      linkdiv = (
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
      );
    }

    let vsp = <div style={{ height: 20 }} />;
    let divStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let lhcolStyle = { width: '20%' };
    let transfer = () => {
      let amount = this.state.transferAmount;
      let transferTo = this.state.transferTo;
      let req: Rpc.TransferCreditsRequest = { transferTo, amount };
      if (amount > 0 && transferTo) {
        chrome.runtime.sendMessage({ eventType: "TransferCredits", req, async: true });
        this.setState({ transferAmount: 0 });
      }
    };
    let userp = userNames.length > 0 ? <div><p>You are currently directly connected with another {userNames.length} user{userNames.length > 1 ? "s" : ""}.</p>
      <p>Your social graph currently extends to {st.reachableUserCount} reachable users.</p>
    </div>
      : <p>You are not currently connected with any other users. Hence, no promotions can be issued on your behalf.</p>;

    let authdiv = <p>You are currently authenticated via {st.authprov}</p>;
    if (!st.authprov) {
      let authClick = (provider) => {
        let req: Rpc.AuthenticateRequest = { provider };
        chrome.runtime.sendMessage({ eventType: "Authenticate", req, async: true });
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

    let transferDiv = (
      <div>
        {vsp}
        <p>If you wish, you can transfer credits to another user.</p>
        <div style={divStyle} >
          <div style={{ display: 'inline' }}>Amount to Transfer: </div>
          <input type="number" style={{ display: 'inline', height: 24, marginLeft: 20, marginTop: 6, width: '100' }} ref={(e) => this.ctrls.transferAmount = e}
            value={this.state.transferAmount} onChange={e => this.changeTransferAmount()} />
          <div style={{ display: 'inline', marginLeft: 20 }}>Transfer To: </div>
          <input type="text" style={{ display: 'inline', height: 24, marginLeft: 20, marginTop: 6, width: '200' }} ref={(e) => this.ctrls.transferTo = e}
            value={this.state.transferTo} onChange={e => this.changeTransferTo()} />
          <Button key='transfer' className="pt-intent-primary" style={{ display: 'inline', marginLeft: 20 }} onClick={() => transfer()} text="Transfer" />
        </div>
      </div>);

    return (
      <div>
        <h3>Status and Settings.</h3>
        <div style={divStyle}>
          {userp}
          {authdiv}
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
        {vsp}
        <div>
          <h4>Investments : </h4>
          {vsp}
          <h6>Your Current Wallet Balance is : {st.credits}.</h6>
          {transferDiv}
          {vsp}
          {invdiv}
        </div>
        {vsp}
        <div>
          <h4>Promoted Links for you : </h4>
          {vsp}
          {linkdiv}
        </div>
        {vsp}
        <div>
          <h4>Your Posts : </h4>
          {vsp}
          {postsdiv}
          {vsp}
          <div style={divStyle}>
            <Button className="pt-intent-primary" onClick={() => chrome.runtime.sendMessage({ eventType: "CreatePost" })} text="Create New Post" />
          </div>
        </div>
        {vsp}
        <div>
          <h4>Your Videos : </h4>
          {vsp}
          {vidsdiv}
          {vsp}
          <Dropzone onDrop={this.onDropVideos}>
            <div>Try dropping some video files here, or click to select video filess to upload.</div>
          </Dropzone>
          {vsp}
          <div>
            <h4>Your Audios : </h4>
            {vsp}
            {audsdiv}
            {vsp}
            <Dropzone onDrop={this.onDropAudios} accept="audio/mpeg,audio/mp3,audio.wav,audio/mp4">
              <div>Try dropping some audio files here, or click to select audio files to upload.</div>
            </Dropzone>
          </div>
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