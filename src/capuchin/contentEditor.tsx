"use strict";

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button } from "@blueprintjs/core";
import { Row, Col } from 'react-simple-flex-grid';

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


interface ContentProps { appState: AppState, onClose?: () => void };
interface ContentState { title: string, content: string, tags: string[], editing: boolean, isError: boolean, prevContent: string };


export class ContentEditor extends React.Component<ContentProps, ContentState> {

  constructor(props: ContentProps) {
    super(props);
    let p = props.appState.currentContent;
    let { title, tags, content } = p
    if (!tags) tags = [];
    this.state = { title, content, tags, editing: true, isError: false, prevContent: content };
  }

  ctrls: {
    title: HTMLInputElement,
    body: HTMLTextAreaElement,
    investment: HTMLInputElement,
  } = { title: null, body: null, investment: null };

  save() {
    if (this.state.isError) return;
    let title = this.state.title;
    let tags = this.state.tags;
    let cont = this.props.appState.currentContent;
    let content: Dbt.Content = { ...cont, content: this.state.content, title, tags };
    let req: Rpc.SaveContentRequest = { content };
    Chrome.sendMessage({ eventType: "SaveContent", req });
    this.close()
  }

  close() {
    if (this.props.onClose) this.props.onClose();
    else window.close();
  }

  startEdit() { this.setState({ editing: true, prevContent: this.state.content }) }
  stopEdit() { this.setState({ editing: false }) }
  abandonEdit() {
    this.setState({ editing: false, content: this.state.prevContent });
    this.close();
  }

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeBody(e) { this.setState({ content: e.target.value }); }
  changeTags(tags: string[]) {
    this.setState({ tags });
    Chrome.sendSyncMessage({ eventType: "SaveTags", tags })
  }

  render() {
    let currInfo = this.props.appState.currentContent;
    let creator = this.props.appState.moniker
    if (!currInfo) return null;
    let rowStyle = { width: '100%', marginTop: 2, marginLeft: 5, padding: 6 };
    //let btnStyle = { height: '24', marginTop: 2, marginLeft: 5, marginRight: 5, display: 'inline-block' };
    let lhcolStyle = { width: '20%' };
    if (this.state.editing) {
      let btns = [
        <Button style={btnStyle} key='save' className="pt-intent-primary" onClick={() => this.save()} text="Save" />,
        <Button style={btnStyle} key='stop' onClick={() => this.abandonEdit()} text="Abandon" />
      ];
      if (currInfo.contentType === 'post') {
        btns = [
          <Button style={btnStyle} key='review' className="pt-intent-primary" onClick={() => this.stopEdit()} text="Review" />,
          <Button style={btnStyle} key='stop' onClick={() => this.abandonEdit()} text="Abandon" />
        ];
      }

      return (
        <div>
          <Row style={rowStyle} >
            <Col style={lhcolStyle}>Title:</Col>
            <Col>
              <input type="text" style={{ marginTop: 6, height: 30, width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
            </Col>
          </Row>
          <Row style={rowStyle} >
            <Col style={lhcolStyle}>Body:</Col>
            <Col>
              <textarea style={{ width: '100%', minHeight: 400 }} ref={(e) => this.ctrls.body = e} value={this.state.content} onChange={e => this.changeBody(e)} />
            </Col>
          </Row>
          <Row style={rowStyle} >
            <Col>
              <span style={lhcolStyle}>Tags: </span>
              <TagGroupEditor tags={this.state.tags} allTags={this.props.appState.allTags} onChange={tags => this.changeTags(tags)} />
            </Col>
          </Row>
          <Row style={rowStyle} >
            {btns}
          </Row>
        </div>
      );
    } else {
      let { content, title, tags } = this.state;
      let info: Dbt.Content = { ...currInfo, content, title, tags, userId: '', contentId: 0 };
      return (
        <div>
          <ContentView info={info} creator={creator} />
          <div style={rowStyle} >
            <Button key='save' className="pt-intent-primary" style={btnStyle} onClick={() => this.save()} text="Save" />
            <Button key='edit' style={btnStyle} onClick={() => this.startEdit()} text="Edit" />
            <Button key='abandon' style={btnStyle} onClick={() => this.abandonEdit()} text="Abandon" />
          </div>
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