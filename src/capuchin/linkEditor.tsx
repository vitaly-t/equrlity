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
import { rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

import * as Chrome from './chrome';

interface LinkEditorProps { info: Dbt.Link, allTags: Tags.TagSelectOption[], onClose: () => void }
interface LinkEditorState { title: string, comment: string, tags: string[], isError: boolean, isOpen: boolean };

export class LinkEditor extends React.Component<LinkEditorProps, LinkEditorState> {

  constructor(props: LinkEditorProps) {
    super(props);
    let p = props.info
    let { title, tags, comment } = p
    this.state = { title, comment, tags, isError: false, isOpen: true };
  }

  ctrls: {
    title: HTMLInputElement,
    comment: HTMLTextAreaElement,
  } = { title: null, comment: null };

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  save() {
    let { title, tags, comment } = this.state;
    let link = this.props.info
    link = { ...link, title, tags, comment };
    let req: Rpc.SaveLinkRequest = { link };
    Chrome.sendMessage({ eventType: "SaveLink", req });
    this.close()
  }

  cancel() {
    this.close()
  }

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeComment(e) { this.setState({ comment: e.target.value }); }
  changeTags(tags: string[]) {
    this.setState({ tags });
    Chrome.sendSyncMessage({ eventType: "SaveTags", tags })
  }

  render() {
    let gutter = 20;
    let btnStyle = { marginRight: gutter / 2 };
    let rowStyle = { padding: 4 };

    return (
      <Dialog iconName="inbox" style={{ width: '80%' }} isOpen={this.state.isOpen} title={"Edit Content Info"} canOutsideClickClose={false} onClose={() => this.close()} >
        <div style={{ padding: gutter }}>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={1}>Title:</Col>
            <Col span={8}>
              <input type="text" style={{ width: '100%' }} ref={(e) => this.ctrls.title = e} value={this.state.title} onChange={e => this.changeTitle(e)} />
            </Col>
          </Row>
          <Row span={2}>Comment:</Row>
          <Row span={12}>
            <TextareaAutosize style={{ width: '100%', minHeight: "100px", maxHeight: "600px" }} ref={(e) => this.ctrls.comment = e} value={this.state.comment} onChange={e => this.changeComment(e)} />
          </Row>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={1}>Tags:</Col>
            <Col span={10}>
              <Tags.TagGroupEditor tags={this.state.tags} allTags={this.props.allTags} onChange={tags => this.changeTags(tags)} />
            </Col>
          </Row>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={12}>
              <Button key='save' className="pt-intent-primary" style={btnStyle} onClick={() => this.save()} text="Save" />
              <Button key='cancel' style={btnStyle} onClick={() => this.cancel()} text="Cancel" />
            </Col>
          </Row>
        </div>
      </Dialog >

    );
  }
}

