"use strict";

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button } from "@blueprintjs/core";

import * as oxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';
import { TagGroupEditor } from '../lib/tags';
import { TimeSpan } from '../lib/timeSpan';
import { ContentView, rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

import { AppState, postDeserialize } from "./AppState";
import { sendGetContentBody, sendSaveContent } from './Comms';
import * as Chrome from './chrome';


interface ContentProps { appState: AppState };
interface ContentState { title: string, content: string, tags: string[], editing: boolean, isError: boolean, prevContent: string, investment: number };


export class ContentEditor extends React.Component<ContentProps, ContentState> {

  constructor(props: ContentProps) {
    super(props);
    let p = props.appState.currentContent;
    let { title, tags, content } = p
    this.state = { title, content, tags, editing: true, isError: false, prevContent: content, investment: 20 };
  }

  ctrls: {
    title: HTMLInputElement,
    body: HTMLTextAreaElement,
    investment: HTMLInputElement,
  } = { title: null, body: null, investment: null };

  save(publish: boolean = false) {
    if (this.state.isError) return;
    let title = this.state.title;
    let tags = this.state.tags;
    let cont = this.props.appState.currentContent;
    let content = this.state.content;
    let investment = this.state.investment;
    let req: Rpc.SaveContentRequest = { contentId: cont.contentId, contentType: cont.contentType, mime_ext: cont.mime_ext, title, tags, content, publish, investment };
    Chrome.sendMessage({ eventType: "SaveContent", req });
  }

  publish() { this.save(true); }

  startEdit() { this.setState({ editing: true, prevContent: this.state.content }) }
  stopEdit() { this.setState({ editing: false }) }
  abandonEdit() { this.setState({ editing: false, content: this.state.prevContent }); }

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeBody(e) { this.setState({ content: e.target.value }); }
  changeInvestment(e) { this.setState({ investment: parseInt(e.target.value) }); }

  removeTag(lbl) {
    let tags = this.state.tags;
    let i = tags.indexOf(lbl);
    if (i >= 0) {
      tags = tags.splice(i, 1);
      this.setState({ tags });
    }
  }

  render() {
    let currInfo = this.props.appState.currentContent;
    let creator = this.props.appState.moniker
    if (!currInfo) return null;
    let rowStyle = { width: '100%', marginTop: 2, marginLeft: 5, padding: 6 };
    //let btnStyle = { height: '24', marginTop: 2, marginLeft: 5, marginRight: 5, display: 'inline-block' };
    let lhcolStyle = { width: '20%' };
    if (this.state.editing) {

      return (
        <div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Title:</div>
            <input type="text" style={{ marginTop: 6, height: 30, width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
          </div>
          <div style={rowStyle} >
            <div style={lhcolStyle}>Body:</div>
            <textarea style={{ width: '100%', minHeight: 400 }} ref={(e) => this.ctrls.body = e} value={this.state.content} onChange={e => this.changeBody(e)} />
          </div>
          <div style={rowStyle} >
            <span style={lhcolStyle}>Tags: </span>
            <TagGroupEditor tags={this.state.tags} allTags={this.props.appState.allTags} onChange={tags => this.setState({ tags })} />
          </div>
          <div style={rowStyle} >
            <Button key='review' className="pt-intent-primary" style={btnStyle} onClick={() => this.stopEdit()} text="Save" />
            <Button key='stop' style={btnStyle} onClick={() => this.abandonEdit()} text="Abandon" />
          </div>
        </div>
      );
    } else {
      let { content, title, tags } = this.state;
      let info: Rpc.ContentInfoItem = { ...currInfo, content, title, tags, userId: '', contentId: 0 };
      let pubdiv = null;
      if (!currInfo.published) {
        pubdiv = <div style={rowStyle} >
          <div style={{ display: 'inline' }}>Investment: </div>
          <input type="text" style={{ display: 'inline', height: 24, marginTop: 6, width: '100' }} ref={(e) => this.ctrls.investment = e} value={this.state.investment} onChange={e => this.changeInvestment(e)} />
          <Button key='publish' className="pt-intent-success" style={btnStyle} onClick={() => this.publish()} text="Publish" />
        </div>;
      }
      return (
        <div>
          <ContentView info={info} creator={creator} />
          <div style={rowStyle} >
            <Button key='edit' className="pt-intent-primary" style={btnStyle} onClick={() => this.startEdit()} >Edit</Button>
            <Button key='save' className="pt-intent-primary" style={btnStyle} onClick={() => this.save()} >Save</Button>
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
    ReactDOM.render(<ContentEditor appState={state} />, elem);
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