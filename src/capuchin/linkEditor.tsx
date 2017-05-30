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
import { rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

import * as Chrome from './chrome';

interface LinkEditorProps { info: Rpc.UserLinkItem, allTags: Tags.TagSelectOption[], onClose: () => void }
interface LinkEditorState { title: string, comment: string, tags: string[], isError: boolean, isOpen: boolean, isPublic: boolean };

export class LinkEditor extends React.Component<LinkEditorProps, LinkEditorState> {

  constructor(props: LinkEditorProps) {
    super(props);
    let p = props.info.link;
    let { title, tags, comment, isPublic } = p
    this.state = { title, comment, tags, isPublic, isError: false, isOpen: true };
  }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  save() {
    let { title, tags, comment, isPublic } = this.state;
    let link = this.props.info.link;
    link = { ...link, title, tags, comment, isPublic };
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
    let item = this.props.info;
    let l = item.link;
    let created = l.created ? OxiDate.toFormat(new Date(l.created), "DDDD, MMMM D @ HH:MIP") : '';
    let updated = l.updated ? OxiDate.toFormat(new Date(l.updated), "DDDD, MMMM D @ HH:MIP") : '';

    return (
      <Dialog iconName="inbox" style={{ width: '600px' }} isOpen={this.state.isOpen} title={"Edit Investment"} canOutsideClickClose={false} onClose={() => this.close()} >
        <div style={{ padding: gutter }}>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={2}>Title:</Col>
            <Col span={8}>
              <input type="text" style={{ width: '100%' }} value={this.state.title} onChange={e => this.changeTitle(e)} />
            </Col>
            <Col span={2}><Checkbox label="Public?" checked={this.state.isPublic} onChange={e => this.setState({ isPublic: !this.state.isPublic })} /></Col>
          </Row>
          <Row style={rowStyle} gutter={gutter}><Col span={1}>Comment:</Col></Row>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={12}>
              <TextareaAutosize style={{ width: '100%', minHeight: "100px", maxHeight: "600px" }} value={this.state.comment} onChange={e => this.changeComment(e)} />
            </Col>
          </Row>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={2}>Promotions:</Col>
            <Col span={2}>{item.promotionsCount.toString()}</Col>
            <Col span={2}>Deliveries:</Col>
            <Col span={2}>{item.deliveriesCount.toString()}</Col>
          </Row>
          <Row style={rowStyle} gutter={gutter}>
            <Col span={2}>Created:</Col>
            <Col span={8}>{created}</Col>
          </Row>
          {updated !== created && <Row style={rowStyle} gutter={gutter}>
            <Col span={2}>Updated:</Col>}
            <Col span={8}>{updated}</Col>}
          </Row>}
          <Row style={rowStyle} gutter={gutter}>
            <Col span={2}>Tags:</Col>
            <Col span={10}>
              <Tags.TagGroupEditor tags={this.state.tags} creatable={true} allTags={this.props.allTags} onChange={tags => this.changeTags(tags)} />
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

