import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, ProgressBar, Checkbox } from "@blueprintjs/core";
import * as Dropzone from 'react-dropzone';
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { Row, Col } from 'react-simple-flex-grid';


import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import * as OxiGen from '../gen/oxigen';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Tags from '../lib/tags';

import { YesNoBox } from './dialogs';
import { AppState, postDeserialize } from "./AppState";
import { uploadRequest } from "./Comms";
import * as Chrome from './chrome';
import { ContentEditor } from './contentEditor';

type UploadProgress = { fileName: string, progress: number }

interface ContentsPageProps { appState: AppState };
interface ContentsPageState { uploadProgress: UploadProgress[], publishingContent?: Dbt.Content, editingContent?: Dbt.Content, confirmDeleteContent?: Dbt.Content };

export class ContentsPage extends React.Component<ContentsPageProps, ContentsPageState> {

  constructor(props) {
    super(props);
    this.state = { uploadProgress: [] };
  }

  setUploadProgress(nm: string, progress: number) {
    let uploadProgress = [...this.state.uploadProgress]
    let i = uploadProgress.findIndex(u => u.fileName === nm);
    if (i < 0) {
      console.log("file gone?");
    }
    else {
      if (progress === 1) uploadProgress.splice(i, 1);
      else uploadProgress[i].progress = progress;
      this.setState({ uploadProgress });
    }
  }

  onDropMedia = async (acceptedFiles, rejectedFiles) => {
    console.log('Accepted files: ', acceptedFiles);
    console.log('Rejected files: ', rejectedFiles);
    if (rejectedFiles.length > 0) return;
    if (acceptedFiles.length === 0) return;
    let uploadProgress = acceptedFiles.map(f => { return { fileName: f.name, progress: 0 }; });
    this.setState({ uploadProgress });
    let uploadFile = async (f: any) => {
      var data = new FormData();
      data.append(f.name, f);
      let config = { onUploadProgress: (progressEvent) => { this.setUploadProgress(f.name, progressEvent.loaded / progressEvent.total) } };
      let req = uploadRequest(this.props.appState);
      let response = await req.post(Utils.serverUrl + '/upload/media', data, config);
      let contents: Dbt.Content[] = response.data;
      Chrome.sendSyncMessage({ eventType: "AddContents", contents })
    }
    for (var f of acceptedFiles) await uploadFile(f);
  }

  createPost() {
    let cont = OxiGen.emptyRec<Dbt.Content>("contents");
    cont = { ...cont, contentType: 'post', mime_ext: 'markdown' }
    this.setState({ editingContent: cont });
  }

  render() {
    let st = this.props.appState;
    let contsdiv = <p>You do not currently have any uploaded contents.</p>
    if (this.state.confirmDeleteContent) {
      let msg = "Warning: Deleting a Content Item is irreversible. Are you sure you wish to Proceed?";
      let onClose = () => this.setState({ confirmDeleteContent: null });
      let contentId = this.state.confirmDeleteContent.contentId;
      let onYes = () => Chrome.sendMessage({ eventType: "RemoveContent", req: { contentId } });
      contsdiv = <YesNoBox message={msg} onYes={onYes} onClose={onClose} />
    }
    else if (this.state.publishingContent) {
      let onClose = () => this.setState({ publishingContent: null });
      contsdiv = <PublishContent info={this.state.publishingContent} allTags={this.props.appState.allTags} onClose={onClose} />
    }
    else if (this.state.editingContent) {
      let onClose = () => this.setState({ editingContent: null });
      contsdiv = <ContentEditor info={this.state.editingContent} allTags={this.props.appState.allTags} creator={this.props.appState.moniker} onClose={onClose} />
    }
    else if (st.contents.length > 0) {
      let rows = st.contents.map(p => {
        let url = p.contentType === 'link' ? p.url : Utils.contentToUrl(p.contentId)
        //let onclick = () => { chrome.tabs.create({ active: true, url }); };
        let created = p.created ? OxiDate.toFormat(new Date(p.created), "DDDD, MMMM D @ HH:MIP") : '';
        let updated = p.updated ? OxiDate.toFormat(new Date(p.updated), "DDDD, MMMM D @ HH:MIP") : '';
        let remove = () => { this.setState({ confirmDeleteContent: p }) };
        let btns = [<Button onClick={remove} text="Delete" />];
        let tags = p.tags && p.tags.length > 0 ? p.tags.join(", ") : '';
        let edit = () => { this.setState({ editingContent: p }) };
        btns.push(<Button onClick={edit} text="Edit" />);

        let publish = () => { this.setState({ publishingContent: p }) };
        btns.push(<Button onClick={publish} text="Publish" />);

        return (
          <tr key={p.contentId} >
            <td>{p.contentType}</td>
            <td><a href={url} >{url}</a></td>
            <td>{p.title}</td>
            <td><Checkbox disabled defaultChecked={p.isPublic} /></td>
            <td>{created}</td>
            <td>{updated}</td>
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
              <th>Link</th>
              <th>Title</th>
              <th>Public?</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Published</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>);
    }

    let vsp = <div style={{ height: 20 }} />;
    let divStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let lhcolStyle = { width: '20%' };
    let uploadDiv;
    if (this.state.uploadProgress.length > 0) {
      let uplds = this.state.uploadProgress.map(u => <div><p>{u.fileName}:</p><ProgressBar value={u.progress} /></div>);
      uploadDiv =
        <div>
          <h4>Uploading : </h4>
          {uplds}
        </div>
    }
    else {
      uploadDiv =
        <div>
          <h4>Upload new Content(s) : </h4>
          {vsp}
          <Dropzone onDrop={this.onDropMedia}>
            <div> Drop some audio/ video / image files here, or click to select files to upload.</div>
          </Dropzone>
          {vsp}
        </div>
    }
    return (
      <div>
        <div>
          <h4>Your Contents : </h4>
          {vsp}
          {contsdiv}
          {vsp}
          <div style={divStyle}>
            <Button className="pt-intent-primary" onClick={() => this.createPost()} text="Create New Post" />
          </div>
        </div>
        {vsp}
        {uploadDiv}
      </div>);
  }
}

interface PublishContentProps { info: Dbt.Content, allTags: Tags.TagSelectOption[], onClose: () => void }
interface PublishContentState { title: string, comment: string, tags: string[], isOpen: boolean, amount: number }
class PublishContent extends React.Component<PublishContentProps, PublishContentState> {
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
    let req: Rpc.PromoteContentRequest = { contentId: info.contentId, title, comment, tags, amount };
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
    ReactDOM.render(<ContentsPage appState={state} />, elem);
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

