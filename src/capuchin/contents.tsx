import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, ProgressBar, Checkbox, Position, IToaster, Popover, PopoverInteractionKind } from "@blueprintjs/core";
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
import { rowStyle, btnStyle, lhcolStyle } from "../lib/constants";
import * as Tags from '../lib/tags';
import * as Hasher from '../lib/contentHasher';
import { YesNoBox } from '../lib/dialogs';
import { uploadRequest, signData, sendApiRequest } from "../lib/axiosClient";
import buildWaveform from '../lib/buildWaveform';

import { AppState, postDeserialize } from "./AppState";
import * as Chrome from './chrome';
import { ContentEditor } from './contentEditor';
import { PanelContext } from "./home";

type UploadProgress = { fileName: string, progress: number }

const gutter = 20;

interface ContentsPanelProps { appState: AppState, panelContext: PanelContext };
interface ContentsPanelState { uploadProgress: UploadProgress[], cancelUpload: boolean, promotingContent?: Dbt.Content, editingContent?: Dbt.Content, confirmDeleteContent?: Dbt.Content };

export class ContentsPanel extends React.Component<ContentsPanelProps, ContentsPanelState> {

  constructor(props) {
    super(props);
    this.state = { uploadProgress: [], cancelUpload: false };
  }

  setUploadProgress(nm: string, progress: number) {
    let uploadProgress = [...this.state.uploadProgress]
    let i = uploadProgress.findIndex(u => u.fileName === nm);
    if (i < 0) {
      if (!this.state.cancelUpload) this.props.panelContext.toast.show({ message: "Missing file: " + nm });
    }
    else {
      if (progress === 1) uploadProgress.splice(i, 1);
      else uploadProgress[i].progress = progress;
      this.setState({ uploadProgress });
    }
  }

  onDropMedia = async (acceptedFiles, rejectedFiles) => {
    //console.log('Accepted files: ', acceptedFiles);
    //console.log('Rejected files: ', rejectedFiles);
    if (rejectedFiles.length > 0) return;
    if (acceptedFiles.length === 0) return;
    let uploadProgress = acceptedFiles.map(f => { return { fileName: f.name, progress: 0 }; });
    this.setState({ uploadProgress });

    function calcDigest(a: ArrayBuffer): string {
      let buf = new Buffer(new Uint8Array(a));
      return Hasher.calcHashBuffer(buf)
    }

    let uploadFile = async (f: any) => {
      let rdr = new FileReader();
      rdr.readAsArrayBuffer(f)
      while (rdr.readyState != 2) await Utils.sleep(2);
      let digest = calcDigest(rdr.result);
      let sig = await signData(this.props.appState.privateKey, digest);
      let peaks = await buildWaveform(rdr.result);

      //console.log("digest: " + digest);
      var data = new FormData();
      data.append("hash", digest);
      data.append("sig", sig);
      data.append("peaks", peaks);
      data.append(f.name, f);
      let toast = this.props.panelContext.toast;
      let CancelToken = axios.CancelToken;
      let source = CancelToken.source();
      let cancelToken = source.token
      let config = {
        cancelToken, onUploadProgress: (progressEvent) => {
          if (this.state.cancelUpload) {
            source.cancel("upload cancelled");
            this.setState({ uploadProgress: [] });
          }
          this.setUploadProgress(f.name, progressEvent.loaded / progressEvent.total)
        }
      };
      let req = uploadRequest();

      let response;
      try {
        response = await req.post(Utils.serverUrl + '/upload/media', data, config);
      }
      catch (e) {
        if (axios.isCancel(e)) {
          toast.show({ message: "Upload cancelled" });
          return;
        }
        throw (e);
      }
      let cont: Dbt.Content = response.data;
      if (!cont || !cont.contentId) {
        toast.show({ message: "Server failed to process: " + f.fileName });
        return;
      }
      if (digest !== cont.db_hash) {
        toast.show({ message: "Server returned incorrect hash for: " + f.fileName });
        return;
      }
      Chrome.sendSyncMessage({ eventType: "AddContents", contents: [cont] })
    }
    for (var f of acceptedFiles) await uploadFile(f);
    if (this.state.cancelUpload) this.setState({ cancelUpload: false });
  }

  setImageAsProfilePic = async (cont: Dbt.Content) => {
    if (cont.contentType !== 'image') throw new Error("not an image");
    let { user } = this.props.appState;
    user = { ...user, profile_pic: cont.db_hash }
    sendApiRequest("changeSettings", user);
  }

  createPost() {
    let cont = OxiGen.emptyRec<Dbt.Content>("contents");
    cont = { ...cont, contentType: 'post', mime_ext: 'markdown' }
    this.setState({ editingContent: cont });
  }

  render() {
    let st = this.props.appState;
    let panelContext = this.props.panelContext
    let { vsp } = panelContext;
    let contsdiv = <p>You do not currently have any uploaded contents.</p>
    if (this.state.confirmDeleteContent) {
      let msg = "Warning: Deleting a Content Item is irreversible. Are you sure you wish to Proceed?";
      let onClose = () => this.setState({ confirmDeleteContent: null });
      let contentId = this.state.confirmDeleteContent.contentId;
      let onYes = () => Chrome.sendMessage({ eventType: "RemoveContent", req: { contentId } });
      contsdiv = <YesNoBox message={msg} onYes={onYes} onClose={onClose} />
    }
    else if (this.state.promotingContent) {
      let onClose = () => this.setState({ promotingContent: null });
      contsdiv = <ShareContent info={this.state.promotingContent} allTags={this.props.appState.allTags} onClose={onClose} toast={panelContext.toast} />
    }
    else if (this.state.editingContent) {
      let onClose = () => this.setState({ editingContent: null });
      contsdiv = <ContentEditor info={this.state.editingContent} allTags={this.props.appState.allTags} creator={this.props.appState.user.userName} onClose={onClose} />
    }
    else if (st.contents.length > 0) {
      let tagfilter = (tags: string[], typ: string): boolean => {
        if (!tags) tags = [];
        let fltrs = panelContext.filters();
        for (let f of fltrs) if (tags.indexOf(f) < 0 && f !== typ) return false;
        return true;
      }
      let rows = st.contents.filter(p => tagfilter(p.tags, p.contentType)).map(p => {
        let url = p.contentType === 'bookmark' ? p.url : Utils.contentToUrl(p.contentId)
        let tags = <Tags.TagGroup tags={p.tags} onClick={(s) => panelContext.addFilter(s)} />;

        let btns = [];

        let share = () => { this.setState({ promotingContent: p }) };
        btns.push(<Button key="share" onClick={share} text="Share" />);

        let edit = () => { this.setState({ editingContent: p }) };
        btns.push(<Button key="edit" onClick={edit} text="Edit" />);

        let clone = () => {
          let cont = { ...p, contentId: null };
          let req: Rpc.SaveContentRequest = { content: cont };
          Chrome.sendMessage({ eventType: "SaveContent", req });
        };
        btns.push(<Button key="clone" onClick={clone} text="Clone" />);

        let remove = () => { this.setState({ confirmDeleteContent: p }) };
        btns.push(<Button key="remove" onClick={remove} text="Delete" />);

        if (p.contentType === 'image') {
          let clss = p.db_hash === st.user.profile_pic ? 'pt-icon-tick' : '';
          btns.push(<Button key="profilepic" className={clss} onClick={() => this.setImageAsProfilePic(p)} text="Use as Profile Pic" />);
        }

        let btngrp = (
          <div className="pt-button-group pt-vertical pt-align-left pt-large">
            {btns}
          </div>
        );
        let pop = (<Popover content={btngrp} popoverClassName="pt-minimal" interactionKind={PopoverInteractionKind.HOVER} position={Position.BOTTOM} >
          <Button iconName="pt-icon-cog" text="" />
        </Popover>
        );
        return (
          <tr key={p.contentId} >
            <td><Tags.TagGroup tags={[p.contentType]} onClick={(s) => panelContext.addFilter(s)} /></td>
            <td><a href={url} target="_blank" >{url}</a></td>
            <td>{p.title}</td>
            <td>{tags}</td>
            <td>{pop}</td>
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
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>);
    }

    let fltrDiv = null;
    let filters = panelContext.filters();
    if (filters.length > 0) {
      let fltrs = <Tags.TagGroup tags={filters} onRemove={(s) => panelContext.removeFilter(s)} />;
      fltrDiv = <div>{vsp}<Row>Showing :  {fltrs}</Row></div>;
    }

    let uploadDiv;
    if (this.state.uploadProgress.length > 0) {
      let uplds = this.state.uploadProgress.map(u => <div><p>{u.fileName}:</p><ProgressBar value={u.progress} /></div>);
      uploadDiv =
        <div>
          <h4>Uploading : </h4>
          {uplds}
          {vsp}
          <Button className="pt-intent-primary" onClick={() => this.setState({ cancelUpload: true })} text="Cancel" />
        </div>
    }
    else {
      let formats = '.flac, .ogv, .ogm, .ogg, .oga, .webm, .weba, .wav, .mp4, .m4v, .m4a, .mp3'
      uploadDiv =
        <div>
          <h4>Upload new Content(s) : </h4>
          {vsp}
          <Dropzone style={{ width: '400px', height: '200px', border: '3px dashed', }} accept={formats} onDrop={this.onDropMedia}>
            <div>
              <p>Drop some audio/ video / image files here, or click to select files to upload</p>
              <p>Supported formats are:</p>
              <p>{formats}</p>
            </div>
          </Dropzone>
          {vsp}
        </div>
    }
    return (
      <div>
        {fltrDiv}
        {vsp}
        {contsdiv}
        {vsp}
        <div style={rowStyle}>
          <Button className="pt-intent-primary" onClick={() => this.createPost()} text="Create New Post" />
        </div>
        {vsp}
        {uploadDiv}
      </div>);
  }
}

interface ShareContentProps { info: Dbt.Content, allTags: Tags.TagSelectOption[], onClose: () => void, toast: IToaster }
interface ShareContentState { title: string, comment: string, tags: string[], isOpen: boolean, amount: number, stringSchedule: string }
class ShareContent extends React.Component<ShareContentProps, ShareContentState> {

  constructor(props: ShareContentProps) {
    super(props);
    let tags = props.info.tags || [];
    tags.unshift(props.info.contentType);
    let paymentSchedule = this.isMediaType() ? Utils.defaultPaymentSchedule() : [];
    let stringSchedule = paymentSchedule.map(i => i.toString()).join();
    this.state = { isOpen: true, amount: 0, title: props.info.title, tags, comment: '', stringSchedule };
  }

  isMediaType() { return ['audio', 'video'].indexOf(this.props.info.contentType) >= 0; }

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeTags(e) { this.setState({ tags: e.target.value }); }
  changeComment(e) { this.setState({ comment: e.target.value }); }
  changeInvestment(e) {
    let amount = parseInt(e.target.value);
    if (!isNaN(amount) && amount >= 0) this.setState({ amount });
  }

  changePaymentSchedule(e) { this.setState({ stringSchedule: e.target.value }) }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  save() {
    let { title, tags, amount, comment, stringSchedule } = this.state;
    let paymentSchedule = [];
    let toast = this.props.toast;
    if (this.isMediaType()) {
      let validSched = true
      paymentSchedule = stringSchedule.split(",").map(s => {
        let i = parseInt(s);
        if (isNaN(i)) {
          i = 0;
          validSched = false
        }
        return i;
      });
      if (!validSched) {
        toast.show({ message: "Schedule contains invalid values which need to be corrected before proceeding." });
        return;
      }
      if (amount === 0 && paymentSchedule.findIndex(i => i < 0) >= 0) {
        toast.show({ message: "You need to specify an investment amount, as the schedule contains negative elements." });
        return;
      }
    }
    let info = this.props.info;
    let req: Rpc.ShareContentRequest = { contentId: info.contentId, title, comment, tags, amount, signature: '', paymentSchedule };
    Chrome.sendMessage({ eventType: "ShareContent", req });
    this.close();
  }

  public render() {
    if (!this.state.isOpen) return null;
    let pubdiv = null;
    let ttl = "Share Content"
    let invdiv = null;
    if (this.props.info.contentType !== 'bookmark') {
      let schedule = this.state.stringSchedule;
      invdiv = (<div>
        <div style={rowStyle} >
          <div style={lhcolStyle}>Schedule:</div>
          <input type="text" style={{ marginTop: 6, height: "30px", width: '100%' }} value={schedule} onChange={e => this.changePaymentSchedule(e)} />
        </div>
        <div style={rowStyle} >
          <div style={{ display: 'inline' }}>Investment amount:</div>
          <input type="number" style={{ display: 'inline', height: "24px", marginTop: "6px", width: '100px' }} value={this.state.amount} onChange={e => this.changeInvestment(e)} />
        </div>
      </div>);
    }
    return (
      <Dialog iconName="inbox" isOpen={this.state.isOpen} title={ttl} onClose={() => this.close()} >
        <div className="pt-dialog-body">
          <div style={rowStyle} >
            <div style={lhcolStyle}>Title:</div>
            <input type="text" style={{ marginTop: 6, height: "30px", width: '100%' }} value={this.state.title} onChange={e => this.changeTitle(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Comment:</div>
            <input type="text" style={{ marginTop: 6, height: "30px", width: '100%' }} value={this.state.comment} onChange={e => this.changeComment(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Tags:</div>
            <Tags.TagGroupEditor tags={this.state.tags} creatable={true} allTags={this.props.allTags} onChange={(tags) => this.changeTags(tags)} />
          </div>
        </div>
        {invdiv}
        <div className="pt-dialog-footer">
          <div className="pt-dialog-footer-actions">
            <Button text="Cancel" onClick={() => this.close()} />
            <Button intent={Intent.PRIMARY} onClick={() => this.save()} text="Share" />
          </div>
        </div>
      </Dialog >
    );
  }
}

