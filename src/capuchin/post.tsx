"use strict";

import * as oxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';

import { TimeSpan } from '../lib/timeSpan';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { sendGetPostBody, sendSavePost } from './Comms';
import * as Rpc from '../lib/rpc';

import * as Remarkable from 'remarkable';
const md = new Remarkable({ html: true });

import * as Blueprint from "@blueprintjs/core";
import '@blueprintjs/core/dist/blueprint.css';

import { AppState, postDeserialize } from "./AppState";

interface PostProps { appState: AppState };
interface PostState { title: string, body: string, tags: string, editing: boolean, isError: boolean, prevBody: string, investment: number };

let Tag = (props) => {
  return (<button className="pt-intent-primary" style={{ marginLeft: 3, marginRight: 3 }} {...props} >{props.children}</button>);
};


export class Post extends React.Component<PostProps, PostState> {

  constructor(props: PostProps) {
    super(props);
    let p = props.appState.currentPost;
    let {title, tags} = p
    this.state = { title, body: '', tags: tags.join(","), editing: true, isError: false, prevBody: '', investment: 20 };
  }

  ctrls: {
    title: HTMLInputElement,
    body: HTMLTextAreaElement,
    tags: HTMLInputElement,
    investment: HTMLInputElement,
  } = { title: null, body: null, tags: null, investment: null };

  componentWillMount() {
    if (!this.props.appState.currentPost.postId) return;
    (async () => {
      let response = await sendGetPostBody(this.props.appState)
      let rsp: Rpc.Response = response.data;
      if (rsp.error) {
        this.setState({ body: "Server returned error: " + rsp.error.message, isError: true });
        return;
      }
      let rslt: Rpc.GetPostBodyResponse = rsp.result;
      this.setState({ body: rslt.body, prevBody: rslt.body });
    })();
  }

  save(publish: boolean = false) {
    if (this.state.isError) return;
    let title = this.state.title;
    let tags = this.state.tags.split(',').map(t => t.trim());
    let body = this.state.body;
    let investment = this.state.investment;
    let req: Rpc.SavePostRequest = { postId: this.props.appState.currentPost.postId, title, tags, body, publish, investment };
    chrome.runtime.sendMessage({ eventType: "SavePost", req, async: true });
  }

  publish() { this.save(true); }

  startEdit() { this.setState({ editing: true, prevBody: this.state.body }) }
  stopEdit() { this.setState({ editing: false }) }
  abandonEdit() { this.setState({ editing: false, body: this.state.prevBody }); }

  changeTitle(e) { this.setState({ title: e.target.value }); } 
  changeBody(e) { this.setState({ body: e.target.value }); } 
  changeTags(e) { this.setState({ tags: e.target.value }); } 
  changeInvestment(e) { this.setState({ investment: parseInt(e.target.value) }); } 

  render() {
    let post = this.props.appState.currentPost;
    if (!post) return null;
    let rowStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let btnStyle= { height: '100%', marginTop: 0, marginRight: 10, display: 'inline-block' }; 
    let lhcolStyle = { width: '20%' };
    if (this.state.editing) {

      return (
        <div>
          <div style={rowStyle} >
            <button key='review' className="pt-intent-primary" style={btnStyle} onClick={() => this.stopEdit()} >Review</button>
            <button key='stop' className="pt-intent-primary" style={btnStyle} onClick={() => this.abandonEdit()} >Abandon</button>
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Title:</div>
            <input type="text" style={{ marginTop: 6, height: 30, width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Body:</div>
            <textarea style={{ width: '100%', minHeight: 400}} ref={(e) => this.ctrls.body = e} value={this.state.body} onChange={e => this.changeBody(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Tags:</div>
            <input type="text" style={{ height: 30, marginTop: 6, width: '100%' }} ref={(e) => this.ctrls.tags = e} value={this.state.tags} onChange={e => this.changeTags(e)} />
          </div>
        </div>
      );
    } else {
      let h = { __html: md.render(this.ctrls.body.value) };
      let lstedit = post.updated ? oxiDate.toFormat(new Date(post.updated), "DDDD, MMMM D @ HH:MIP") : 'never';
      let pub = post.published ? oxiDate.toFormat(new Date(post.published), "DDDD, MMMM D @ HH:MIP") : 'never';
      let edits = null;
      let tags = this.ctrls.tags.value.split(',');
      let tagbtns = tags.map(t => <Tag key={'tag:' + t} >{t}</Tag>);
      let pubdiv = null;
      if (!post.published) {
          pubdiv = <div>
            <input type="text" style={{ height: 30, marginTop: 6, width: '100%' }} ref={(e) => this.ctrls.investment = e} value={this.state.investment} onChange={e => this.changeInvestment(e)} />
            <button key='publish' className="pt-intent-primary" style={btnStyle} onClick={() => this.publish()} >Publish</button>
           </div>;
      }
      return (
        <div>
          <h2>{this.ctrls.title.value}</h2>
          <div style={rowStyle} dangerouslySetInnerHTML={h} />
          <div style={rowStyle} >
            {tagbtns}
          </div>
          <div style={rowStyle} >Published: {pub},  Last Edited: {lstedit}.</div>
          <div style={rowStyle} >
            <button key='edit' className="pt-intent-primary" style={btnStyle} onClick={() => this.startEdit()} >Edit</button>
            <button key='save' className="pt-intent-primary" style={btnStyle} onClick={() => this.save()} >Save</button>
          </div>
          {pubdiv}
        </div>
      );
    }
  }
}


function render(state: AppState) {
  console.log("render called");
  let elem = document.getElementById('app')
  if (!elem) console.log("cannot get app element");
  else {
    ReactDOM.render(<Post appState={state} />, elem);
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