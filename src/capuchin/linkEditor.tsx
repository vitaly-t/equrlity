"use strict";

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button } from "@blueprintjs/core";

import * as oxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';
import { TagGroupEditor } from '../lib/tags';
import { TimeSpan } from '../lib/timeSpan';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

import { AppState, postDeserialize } from "./AppState";
import { sendSaveLink } from './Comms';
import * as Chrome from './chrome';


interface LinkProps { appState: AppState };
interface LinkState { title: string, comment: string, tags: string[], isError: boolean };

export class LinkEditor extends React.Component<LinkProps, LinkState> {

  constructor(props: LinkProps) {
    super(props);
    let p = props.appState.currentLink;
    let { title, tags, comment } = p
    this.state = { title, comment, tags, isError: false };
  }

  ctrls: {
    title: HTMLInputElement,
    comment: HTMLTextAreaElement,
  } = { title: null, comment: null };

  save() {
    let { title, tags, comment } = this.state;
    let link = this.props.appState.currentLink;
    link = { ...link, title, tags, comment };
    let req: Rpc.SaveLinkRequest = { link };
    Chrome.sendMessage({ eventType: "SaveLink", req });
    window.close()
  }

  cancel() {
    window.close()
  }

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeComment(e) { this.setState({ comment: e.target.value }); }
  changeTags(tags: string[]) {
    this.setState({ tags });
    Chrome.sendSyncMessage({ eventType: "SaveTags", tags })
  }

  render() {
    return (
      <div>
        <div style={rowStyle} >
          <div style={lhcolStyle}>Title:</div>
          <input type="text" style={{ marginTop: 6, height: 30, width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
        </div>
        <div style={rowStyle} >
          <div style={lhcolStyle}>Body:</div>
          <textarea style={{ width: '100%', minHeight: 400 }} ref={(e) => this.ctrls.comment = e} value={this.state.comment} onChange={e => this.changeComment(e)} />
        </div>
        <div style={rowStyle} >
          <span style={lhcolStyle}>Tags: </span>
          <TagGroupEditor tags={this.state.tags} allTags={this.props.appState.allTags} onChange={tags => this.changeTags(tags)} />
        </div>
        <div style={rowStyle} >
          <Button key='save' className="pt-intent-primary" style={btnStyle} onClick={() => this.save()} text="Save" />
          <Button key='cancel' style={btnStyle} onClick={() => this.cancel()} text="Cancel" />
        </div>
      </div>
    );
  }
}

function render(state: AppState) {
  console.log("render called");
  let elem = document.getElementById('app')
  if (!elem) console.log("cannot get app element");
  else {
    ReactDOM.render(<LinkEditor appState={state} />, elem);
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