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
import { MarkdownEditor } from '../lib/markdownEditor';

import * as Chrome from './chrome';


interface ContentEditorProps { info: Dbt.Content, allTags: Tags.TagSelectOption[], creator: string, onClose: () => void }
interface ContentEditorState { title: string, content: string, tags: string[], isError: boolean, isPublic: boolean, prevContent: string, isOpen: boolean };

export class ContentEditor extends React.Component<ContentEditorProps, ContentEditorState> {

  constructor(props: ContentEditorProps) {
    super(props);
    let p = props.info;
    let { title, tags, content, isPublic } = p
    if (!tags) tags = [];
    this.state = { title, content, tags, isError: false, isPublic, prevContent: content, isOpen: true };
  }

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

  abandonEdit() {
    this.setState({ content: this.state.prevContent });
    this.close();
  }

  changeContent(content: string) {
    console.log("setting content state: " + content);
    this.setState({ content });

  }
  changeTags(tags: string[]) {
    this.setState({ tags });
    Chrome.sendSyncMessage({ eventType: "SaveTags", tags })
  }

  render() {
    let gutter = 20;
    let btnStyle = { marginRight: gutter / 2 };
    let rowStyle = { padding: 4 };
    let { title, isPublic, content, tags, isOpen } = this.state;
    let isDirty = this.state.content !== this.props.info.content;
    let btns = [
      <Button style={btnStyle} key='save' className="pt-intent-primary" onClick={() => this.save()} text="Save" />,
      <Button style={btnStyle} key='stop' onClick={() => this.abandonEdit()} text="Abandon" />
    ];
    return (
      <Dialog iconName="inbox" style={{ width: '80%' }} isOpen={isOpen} title={"Edit Content Info"} canOutsideClickClose={false} onClose={() => this.close()} >
        <div style={{ padding: gutter }}>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={1}>Title:</Col>
            <Col span={8}>
              <input type="text" style={{ width: '100%' }} value={title} onChange={e => this.setState({ title: e.target.value })} />
            </Col>
            <Col span={2}><Checkbox label="Public?" checked={isPublic} onChange={e => this.setState({ isPublic: !this.state.isPublic })} /></Col>
          </Row>
          <Row span={2}>Body:</Row>
          <Row span={12}>
            <MarkdownEditor value={content} onChange={content => this.setState({ content })} isDirty={isDirty} allowHtml={true} />
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
  }
}

