"use strict";

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button, Dialog, Checkbox } from "@blueprintjs/core";
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-autosize-textarea';

import * as oxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';
import * as Tags from '../lib/tags';
import { TimeSpan } from '../lib/timeSpan';
import { ContentView, rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

import * as Chrome from './chrome';


interface ContentEditorProps { info: Dbt.Content, allTags: Tags.TagSelectOption[], creator: string, onClose: () => void }
interface ContentEditorState { title: string, content: string, tags: string[], editing: boolean, isError: boolean, isPublic: boolean, prevContent: string, isOpen: boolean };

export class ContentEditor extends React.Component<ContentEditorProps, ContentEditorState> {

  constructor(props: ContentEditorProps) {
    super(props);
    let p = props.info;
    let { title, tags, content, isPublic } = p
    if (!tags) tags = [];
    this.state = { title, content, tags, editing: true, isError: false, isPublic, prevContent: content, isOpen: true };
  }

  ctrls: {
    title: HTMLInputElement,
    body: HTMLTextAreaElement,
    investment: HTMLInputElement,
  } = { title: null, body: null, investment: null };

  save() {
    if (this.state.isError) return;
    let { title, tags, isPublic, content } = this.state;
    let cont: Dbt.Content = { ...this.props.info, content, title, tags, isPublic };
    let req: Rpc.SaveContentRequest = { content: cont };
    Chrome.sendMessage({ eventType: "SaveContent", req });
    this.close()
  }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
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
    let gutter = 20;
    let btnStyle = { marginRight: gutter / 2 };
    let rowStyle = { padding: 4 };

    if (this.state.editing) {
      let btns = [
        <Button style={btnStyle} key='save' className="pt-intent-primary" onClick={() => this.save()} text="Save" />,
        <Button style={btnStyle} key='stop' onClick={() => this.abandonEdit()} text="Abandon" />
      ];
      if (this.props.info.contentType === 'post') {
        btns = [
          <Button style={btnStyle} key='review' className="pt-intent-primary" onClick={() => this.stopEdit()} text="Review" />,
          <Button style={btnStyle} key='stop' onClick={() => this.abandonEdit()} text="Abandon" />
        ];
      }

      return (
        <Dialog iconName="inbox" style={{ width: '80%' }} isOpen={this.state.isOpen} title={"Edit Content Info"} canOutsideClickClose={false} onClose={() => this.close()} >
          <div style={{ padding: gutter }}>
            <Row style={rowStyle} gutter={gutter}>
              <Col span={1}>Title:</Col>
              <Col span={8}>
                <input type="text" style={{ width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
              </Col>
              <Col span={2}><Checkbox label="Public?" checked={this.state.isPublic} onChange={e => this.setState({ isPublic: !this.state.isPublic })} /></Col>
            </Row>
            <Row span={2}>Body:</Row>
            <Row span={12}>
              <TextareaAutosize style={{ width: '100%', minHeight: "100px", maxHeight: "600px" }} ref={(e) => this.ctrls.body = e} value={this.state.content} onChange={e => this.changeBody(e)} />
            </Row>
            <Row style={rowStyle} gutter={gutter}>
              <Col span={1}>Tags:</Col>
              <Col span={10}>
                <Tags.TagGroupEditor tags={this.state.tags} allTags={this.props.allTags} onChange={tags => this.changeTags(tags)} />
              </Col>
            </Row>
            <Row style={rowStyle} gutter={gutter}>
              <Col span={12}>{btns}</Col>
            </Row>
          </div>
        </Dialog >
      );
    } else {
      let { content, title, tags } = this.state;
      let info: Dbt.Content = { ...this.props.info, content, title, tags, userId: '', contentId: 0 };
      return (
        <Dialog iconName="inbox" style={{ width: '80%' }} isOpen={this.state.isOpen} title={"Preview Content Info"} onClose={() => this.close()} >
          <ContentView info={info} creator={this.props.creator} />
          <div style={rowStyle} >
            <Button key='save' className="pt-intent-primary" style={btnStyle} onClick={() => this.save()} text="Save" />
            <Button key='edit' style={btnStyle} onClick={() => this.startEdit()} text="Edit" />
            <Button key='abandon' style={btnStyle} onClick={() => this.abandonEdit()} text="Abandon" />
          </div>
        </Dialog>
      );
    }
  }
}

