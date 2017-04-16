import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent } from "@blueprintjs/core";
import * as Dropzone from 'react-dropzone';
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';

import * as Rpc from '../lib/rpc'
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";

import { YesNoBox } from './dialogs';
import { AppState, postDeserialize } from "./AppState";
import { uploadRequest } from "./Comms";
import * as Chrome from './chrome';

interface EditContentProps { info: Rpc.ContentInfoItem, onClose: () => void }
interface EditContentState { title: string, tags: string, isOpen: boolean, investment: number }
export class EditContent extends React.Component<EditContentProps, EditContentState> {
  constructor(props: EditContentProps) {
    super(props);
    let tags = props.info.tags && props.info.tags.length > 0 ? props.info.tags.join(", ") : '';
    this.state = { isOpen: true, investment: 0, title: props.info.title, tags };
  }

  ctrls: {
    title: HTMLInputElement,
    tags: HTMLInputElement,
    investment: HTMLInputElement,
  } = { title: null, tags: null, investment: null };

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeTags(e) { this.setState({ tags: e.target.value }); }
  changeInvestment(e) { this.setState({ investment: parseInt(e.target.value) }); }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  save() {
    let title = this.state.title;
    let tags = this.state.tags.split(',').map(t => t.trim());
    let investment = this.state.investment;
    let publish = investment > 0;
    let info = this.props.info;
    let req: Rpc.SaveContentRequest = { contentId: info.contentId, contentType: info.contentType, mime_ext: info.mime_ext, title, tags, publish, investment };
    Chrome.sendMessage({ eventType: "SaveContent", req });
    this.close();
  }

  public render() {
    if (!this.state.isOpen) return null;
    let pubdiv = null;
    let ttl = "Edit Content"
    if (!this.props.info.published) {
      ttl = "Edit / Publish Content"
      pubdiv = (
        <div style={rowStyle} >
          <div style={{ display: 'inline' }}>Publish with Investment amount:</div>
          <input type="number" style={{ display: 'inline', height: 24, marginTop: 6, width: '100px' }} ref={(e) => this.ctrls.investment = e} value={this.state.investment} onChange={e => this.changeInvestment(e)} />
        </div>
      );
    }
    return (
      <Dialog iconName="inbox" isOpen={this.state.isOpen} title={ttl} onClose={() => this.close()} >
        <div className="pt-dialog-body">
          <div style={rowStyle} >
            <div style={lhcolStyle}>Title:</div>
            <input type="text" style={{ marginTop: 6, height: 30, width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Tags:</div>
            <input type="text" style={{ height: 30, marginTop: 6, width: '100%' }} ref={(e) => this.ctrls.tags = e} value={this.state.tags} onChange={e => this.changeTags(e)} />
          </div>
          {pubdiv}
        </div>
        <div className="pt-dialog-footer">
          <div className="pt-dialog-footer-actions">
            <Button text="Cancel" onClick={() => this.close()} />
            <Button
              intent={Intent.PRIMARY}
              onClick={() => this.save()}
              text={this.state.investment ? "Publish" : "Save"}
            />
          </div>
        </div>
      </Dialog >
    );
  }
}

interface SettingsPageProps { appState: AppState };
interface SettingsPageState { nickName: string, email: string, editingContent?: Rpc.ContentInfoItem, confirmDeleteContent?: Rpc.ContentInfoItem, transferAmount: number, transferTo: string };

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
    Chrome.sendMessage({ eventType: "ChangeSettings", settings });
  }

  onDropMedia = async (acceptedFiles, rejectedFiles) => {
    console.log('Accepted files: ', acceptedFiles);
    console.log('Rejected files: ', rejectedFiles);
    if (rejectedFiles.length > 0) return;
    if (acceptedFiles.length === 0) return;
    var data = new FormData();
    for (var f of acceptedFiles) {
      data.append(f.name, f);
      //data.append(f.name,fs.createReadStream(__dirname + `${file}`));
    }
    var config = {
      onUploadProgress: function (progressEvent) {
        var percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      }
    };
    //axios.defaults.headers.common = form.getHeaders();
    let req = uploadRequest(this.props.appState);
    req.post(Utils.serverUrl + '/upload/media', data, config)
      .then((response) => {
        console.log(response.data)
      })
      .catch(e => { console.log(e) })
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
        let i = l.info;
        let tags = i.tags && i.tags.length > 0 ? i.tags.join(", ") : '';
        let redeem = () => { Chrome.sendMessage({ eventType: "RedeemLink", linkId }); };
        let redeemText = l.amount > 0 ? "Redeem" : "Delete";
        let btns = [<Button onClick={redeem} text={redeemText} />];
        let onUrlClick = () => { chrome.tabs.create({ active: true, url }); };
        let edit = () => { Chrome.sendSyncMessage({ eventType: "LaunchContentEditPage", info: i }); };
        btns.push(<Button onClick={edit} text="Edit" />);

        return (
          <tr key={l.linkId} >
            <td><a href="" onClick={onUrlClick} >{url}</a></td>
            <td>{i.content}</td>
            <td>{l.linkDepth}</td>
            <td>{l.promotionsCount}</td>
            <td>{l.deliveriesCount}</td>
            <td>{l.viewCount}</td>
            <td>{l.amount}</td>
            <td>{i.created}</td>
            <td>{i.updated}</td>
            <td>{i.published}</td>
            <td>{tags}</td>
            <td>{btns}</td>
          </tr>
        );
      });
      invdiv = (
        <table className="pt-table pt-striped pt-bordered" >
          <thead>
            <tr>
              <th>URL</th>
              <th>Comment</th>
              <th>Depth</th>
              <th>Promotions</th>
              <th>Deliveries</th>
              <th>Views</th>
              <th>Balance</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Published</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invrows}
          </tbody>
        </table>
      );
    }

    let contsdiv = <p>You do not currently have any uploaded contents.</p>
    if (this.state.confirmDeleteContent) {
      let msg = "Warning: Deleting a Content Item is irreversible. Are you sure you wish to Proceed?";
      let onClose = () => this.setState({ confirmDeleteContent: null });
      let contentId = this.state.confirmDeleteContent.contentId;
      let onYes = () => Chrome.sendMessage({ eventType: "RemoveContent", req: { contentId } });
      contsdiv = <YesNoBox message={msg} onYes={onYes} onClose={onClose} />
    }
    else if (this.state.editingContent) {
      let onClose = () => this.setState({ editingContent: null });
      contsdiv = <EditContent info={this.state.editingContent} onClose={onClose} />
    }
    else if (st.contents.length > 0) {
      let postrows = st.contents.map(p => {
        let url = Utils.contentToUrl(p.contentId)
        let onclick = () => { chrome.tabs.create({ active: true, url }); };
        let created = p.created ? OxiDate.toFormat(new Date(p.created), "DDDD, MMMM D @ HH:MIP") : '';
        let updated = p.updated ? OxiDate.toFormat(new Date(p.updated), "DDDD, MMMM D @ HH:MIP") : '';
        let published = p.published ? OxiDate.toFormat(new Date(p.updated), "DDDD, MMMM D @ HH:MIP") : '';
        let postEdit = null;
        let remove = () => { this.setState({ confirmDeleteContent: p }) };
        let btns = [<Button onClick={remove} text="Delete" />];
        let tags = p.tags && p.tags.length > 0 ? p.tags.join(", ") : '';
        //if (p.contentType === "post") {
        let edit = () => { Chrome.sendSyncMessage({ eventType: "LaunchContentEditPage", info: p }); };
        btns.push(<Button onClick={edit} text="Edit" />);
        //}
        //else {
        //  let edit = () => { this.setState({ editingContent: p }) };
        //  btns.push(<Button onClick={edit} text="Edit" />);
        //}
        return (
          <tr key={p.contentId} >
            <td>{p.contentType}</td>
            <td><a href="" onClick={onclick} >{url}</a></td>
            <td>{p.title}</td>
            <td>{created}</td>
            <td>{updated}</td>
            <td>{published}</td>
            <td>{tags}</td>
            <td>{btns}</td>
          </tr>
        );
      });
      contsdiv = (
        <table className="pt-table pt-striped pt-bordered" >
          <thead>
            <tr>
              <th>Type</th>
              <th>Content</th>
              <th>Title</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Published</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {postrows}
          </tbody>
        </table>);
    }

    let links = st.promotions;
    let linkdiv = <p>There are no new promoted links for you.</p>
    if (links.length > 0) {
      let linkrows = links.map(url => {
        let dismiss = () => { Chrome.sendMessage({ eventType: "DismissPromotion", url }); };
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
        Chrome.sendMessage({ eventType: "TransferCredits", req });
        this.setState({ transferAmount: 0 });
      }
    };
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
          <h4>Your Contents : </h4>
          {vsp}
          {contsdiv}
          {vsp}
          <div style={divStyle}>
            <Button className="pt-intent-primary" onClick={() => Chrome.sendSyncMessage({ eventType: "CreatePost" })} text="Create New Post" />
          </div>
        </div>
        {vsp}
        <div>
          <h4>Upload new Content(s) : </h4>
          {vsp}
          <Dropzone onDrop={this.onDropMedia}>
            <div>Drop some audio/video/image files here, or click to select files to upload.</div>
          </Dropzone>
          {vsp}
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