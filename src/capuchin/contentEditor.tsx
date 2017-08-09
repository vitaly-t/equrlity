"use strict";

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button, Dialog, Checkbox, Toaster, Position } from "@blueprintjs/core";

import * as OxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';
import * as Tags from '../lib/tags';
import { btnStyle, gutter } from "../lib/constants";
import { Panel, Label, Row, Col, TextAuto } from "../lib/components";
import { ContentView } from "../lib/contentview";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import { MarkdownEditor } from '../lib/markdownEditor';
import { sendApiRequest } from "../lib/axiosClient";
import { TrackInfo, TrackInfoEditor, newTrackInfo } from '../lib/trackinfo';

import * as Chrome from './chrome';

const toast = Toaster.create({ position: Position.TOP });

interface ContentEditorProps { content: Dbt.Content, allTags: Tags.TagSelectOption[], style?: any, onClose: () => void }
interface ContentEditorState { content: Dbt.Content, isOpen: boolean };

export class ContentEditor extends React.Component<ContentEditorProps, ContentEditorState> {

  constructor(props: ContentEditorProps) {
    super(props);
    let content = props.content;
    this.state = { content, isOpen: true };
  }

  save = async () => {
    let content = this.state.content;
    let req: Rpc.SaveContentRequest = { content };
    let rsp = await sendApiRequest("saveContent", req);
    if (rsp.data.error) toast.show({ message: rsp.data.error.message });
    else this.close()
  }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  abandonEdit() {
    this.close();
  }

  changeUrl(url: string) {
    let content = { ...this.state.content, url };
    this.setState({ content });
  }

  changeTitle(title: string) {
    let content = { ...this.state.content, title };
    this.setState({ content });
  }

  changeContent(cont: string) {
    let content = { ...this.state.content, content: cont };
    this.setState({ content });
  }

  changeInfo(info: any) {
    let content = { ...this.state.content, info };
    this.setState({ content });
  }

  changeTags(tags: string[]) {
    let content = { ...this.state.content, tags };
    this.setState({ content });
  }

  render() {
    let lspan = 1;
    let { content, isOpen } = this.state;
    let { title, tags, info } = content;
    let isDirty = content !== this.props.content;
    let created = content.created ? OxiDate.toFormat(new Date(content.created), "DDDD, MMMM D @ HH:MIP") : '';
    let updated = content.updated ? OxiDate.toFormat(new Date(content.updated), "DDDD, MMMM D @ HH:MIP") : '';
    let typ = content.contentType
    if (!info && typ === 'audio') info = newTrackInfo();
    let ttl =
      typ === "bookmark" ? "Edit Bookmark"
        : typ === "post" ? "Edit Post"
          : `Edit ${typ} content`;
    let styl = { width: '90%' };
    if (this.props.style) styl = { ...styl, ...this.props.style };
    return (
      <Dialog iconName="inbox" style={styl} isOpen={isOpen} title={ttl} canOutsideClickClose={false} onClose={() => this.close()} >
        <Panel>
          {typ === 'bookmark' && <div>
            <Row><Label span={lspan}>Content ID:</Label><Col span={10}>{content.contentId}</Col></Row>
            <Row><Label span={lspan}>Target:</Label><Col span={10}><TextAuto value={content.url || ''} onChange={url => this.changeUrl(url)} /></Col></Row>
          </div>}
          <Row>
            <Label span={lspan}>Title:</Label>
            <Col span={8}><TextAuto value={title} onChange={ttl => this.changeTitle(ttl)} /></Col>
          </Row>
          {info && <TrackInfoEditor trackInfo={info} lspan={lspan} onChange={ti => this.changeInfo(ti)} />}
          <Row><Label span={lspan}>Description:</Label></Row>
          <Row>
            <Col span={12}>
              <MarkdownEditor value={content.content} onChange={c => this.changeContent(c)} isDirty={isDirty} allowHtml={true} />
            </Col>
          </Row>
          {content.db_hash && <Row>
            <Label span={lspan}>Mime ext.:</Label>
            <Col span={1}>{content.mime_ext}</Col>
            <Label span={lspan}>Hash:</Label>
            <Col span={6}>{content.db_hash}</Col>
          </Row>}
          <Row>
            <Label span={lspan}>Tags:</Label>
            <Col span={10}>
              <Tags.TagGroupEditor tags={content.tags || []} creatable={true} allTags={this.props.allTags} onChange={tags => this.changeTags(tags)} />
            </Col>
          </Row>
          <Row justify="end" >
            <Button style={btnStyle} key='stop' onClick={() => this.abandonEdit()} text="Abandon" />
            <Button style={btnStyle} key='save' className="pt-intent-primary" onClick={() => this.save()} text="Save" />
          </Row>
        </Panel>
      </Dialog >
    );
  }
}

