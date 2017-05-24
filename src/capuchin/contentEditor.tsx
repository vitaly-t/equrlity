"use strict";

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button, Dialog, Checkbox } from "@blueprintjs/core";
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-autosize-textarea';

import * as OxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';
import * as Tags from '../lib/tags';
import { TimeSpan } from '../lib/timeSpan';
import { ContentView, rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import { MarkdownEditor } from '../lib/markdownEditor';

import * as Chrome from './chrome';


interface ContentEditorProps { info: Dbt.Content, allTags: Tags.TagSelectOption[], creator: string, style?: any, onClose: () => void }
interface ContentEditorState { url: Dbt.urlString, title: string, content: string, tags: string[], isError: boolean, isPublic: boolean, prevContent: string, isOpen: boolean };

export class ContentEditor extends React.Component<ContentEditorProps, ContentEditorState> {

  constructor(props: ContentEditorProps) {
    super(props);
    let p = props.info;
    let { title, tags, content, isPublic, url } = p
    if (!tags) tags = [];
    content = content || '';
    url = url || '';
    this.state = { url, title, content, tags, isError: false, isPublic, prevContent: content, isOpen: true };
  }

  save() {
    if (this.state.isError) return;
    let { title, tags, isPublic, content, url } = this.state;
    let cont: Dbt.Content = { ...this.props.info, url, content, title, tags, isPublic };
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
    let lspan = 1;
    let { title, isPublic, content, tags, isOpen } = this.state;
    let { info } = this.props;
    let isDirty = content !== info.content;
    let btns = [
      <Button style={btnStyle} key='save' className="pt-intent-primary" onClick={() => this.save()} text="Save" />,
      <Button style={btnStyle} key='stop' onClick={() => this.abandonEdit()} text="Abandon" />
    ];
    let created = info.created ? OxiDate.toFormat(new Date(info.created), "DDDD, MMMM D @ HH:MIP") : '';
    let updated = info.updated ? OxiDate.toFormat(new Date(info.updated), "DDDD, MMMM D @ HH:MIP") : '';
    let typ = info.contentType
    let hashDiv;
    if (info.db_hash) hashDiv =
      <Row style={rowStyle} gutter={gutter}>
        <Col span={lspan}>Mime ext.:</Col>
        <Col span={1}>{info.mime_ext}</Col>
        <Col span={lspan}>Hash:</Col>
        <Col span={6}>{info.db_hash}</Col>
      </Row>;
    let urlDiv;
    if (typ === 'bookmark') urlDiv = <div>
      <Row style={rowStyle} gutter={gutter}><Col span={lspan}>Content ID:</Col><Col span={10}>{info.contentId}</Col></Row>
      <Row style={rowStyle} gutter={gutter}><Col span={lspan}>Target:</Col><Col span={10}><input type="text" style={{ width: '100%' }} value={this.state.url} onChange={e => this.setState({ url: e.target.value })} /></Col></Row>
    </div>;
    let ttl =
      typ === "bookmark" ? "Edit Bookmark"
        : typ === "post" ? "Edit Post"
          : `Edit ${typ} content`;
    let styl = this.props.style || { width: '90%' };
    return (
      <Dialog iconName="inbox" style={styl} isOpen={isOpen} title={ttl} canOutsideClickClose={false} onClose={() => this.close()} >
        <div style={{ padding: gutter }}>
          {urlDiv}
          <Row style={rowStyle} gutter={gutter}>
            <Col span={lspan}>Title:</Col>
            <Col span={8}>
              <input type="text" style={{ width: '100%' }} value={title} onChange={e => this.setState({ title: e.target.value })} />
            </Col>
            <Col span={2}><Checkbox label="Public?" checked={isPublic} onChange={e => this.setState({ isPublic: !this.state.isPublic })} /></Col>
          </Row>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={lspan}>Body:</Col>
          </Row>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={12}>
              <MarkdownEditor value={content} onChange={content => this.setState({ content })} isDirty={isDirty} allowHtml={true} />
            </Col>
          </Row>
          {hashDiv}
          <Row style={rowStyle} gutter={gutter}>
            <Col span={lspan}>Tags:</Col>
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

