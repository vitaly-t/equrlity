"use strict";

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Button, Dialog, Checkbox, Toaster, Position } from "@blueprintjs/core";
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-textarea-autosize';

import * as OxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';
import * as Tags from '../lib/tags';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/constants";
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import { sendApiRequest } from "../lib/axiosClient";

import * as Chrome from './chrome';

const toast = Toaster.create({
  position: Position.TOP,
});



interface LinkEditorProps { info: Rpc.UserLinkItem, allTags: Tags.TagSelectOption[], onClose: () => void }
interface LinkEditorState { title: string, comment: string, tags: string[], isError: boolean, isOpen: boolean, isPublic: boolean, amount: number };

export class LinkEditor extends React.Component<LinkEditorProps, LinkEditorState> {

  constructor(props: LinkEditorProps) {
    super(props);
    let p = props.info.link;
    let { title, tags, comment, isPublic, amount } = p
    amount = amount || 0;
    this.state = { title, comment, tags, isPublic, isError: false, isOpen: true, amount };
  }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  changeAmount(e) {
    let amount = parseInt(e.target.value);
    if (!isNaN(amount) && amount >= 0) this.setState({ amount });
  }

  save() {
    let { title, tags, comment, isPublic, amount } = this.state;
    let link = this.props.info.link;
    link = { ...link, title, tags, comment, isPublic, amount };
    let req: Rpc.SaveLinkRequest = { link };
    let errHndlr = (msg) => toast.show({ message: "Error: " + msg });
    sendApiRequest("saveLink", req, errHndlr);
    this.close()
  }

  cancel() {
    this.close()
  }

  changeTitle(e) { this.setState({ title: e.target.value }); }
  changeComment(e) { this.setState({ comment: e.target.value }); }
  changeTags(tags: string[]) {
    this.setState({ tags });
  }

  render() {
    let gutter = 20;
    let btnStyle = { marginRight: gutter / 2 };
    let rowStyle = { padding: 4 };
    let item = this.props.info;
    let l = item.link;
    let created = l.created ? OxiDate.toFormat(new Date(l.created), "DDDD, MMMM D @ HH:MIP") : '';
    let updated = l.updated ? OxiDate.toFormat(new Date(l.updated), "DDDD, MMMM D @ HH:MIP") : '';
    let schedule;
    let canInvest = false;
    if (l.paymentSchedule && l.paymentSchedule.length > 0) {
      schedule = l.paymentSchedule.join();
      canInvest = l.paymentSchedule.findIndex(i => i < 0) >= 0;
    }
    let lspan = 2;
    return (
      <Dialog iconName="inbox" style={{ width: '600px' }} isOpen={this.state.isOpen} title={"Edit Share Details"} canOutsideClickClose={false} onClose={() => this.close()} >
        <div className="pt-elevation-0" style={{ width: "100%", height: "100%", backgroundColor: "#F5F8FA" }}>
          <div style={{ margin: '15px' }}>
            <Row style={rowStyle} gutter={gutter}>
              <Col span={lspan}><span className="pt-text-muted" >Title:</span></Col>
              <Col span={7}>
                <input type="text" style={{ width: '100%' }} value={this.state.title} onChange={e => this.changeTitle(e)} />
              </Col>
              <Col><Checkbox label="Public?" className="pt-text-muted" checked={this.state.isPublic} onChange={e => this.setState({ isPublic: !this.state.isPublic })} /></Col>
            </Row>
            <Row style={rowStyle} gutter={gutter}>
              <Col span={lspan}><span className="pt-text-muted" >Comment:</span></Col>
              <Col span={12 - lspan}>
                <TextareaAutosize style={{ width: '100%', minHeight: "100px", maxHeight: "600px" }} value={this.state.comment} onChange={e => this.changeComment(e)} />
              </Col>
            </Row>
            <Row style={rowStyle} gutter={gutter}>
              <Col span={lspan}><span className="pt-text-muted" >Created:</span></Col>
              <Col>{created}</Col>
            </Row>
            {updated !== created && <Row style={rowStyle} gutter={gutter}>
              <Col span={lspan}><span className="pt-text-muted" >Updated:</span></Col>}
            <Col>{updated}</Col>}
          </Row>}
            <Row style={rowStyle} gutter={gutter} align="center">
              <Col span={lspan}><span className="pt-text-muted" >Tags:</span></Col>
              <Col span={10}>
                <Tags.TagGroupEditor tags={this.state.tags} creatable={true} allTags={this.props.allTags} onChange={tags => this.changeTags(tags)} />
              </Col>
            </Row>
            <Row style={rowStyle} gutter={gutter} >
              <Col span={lspan}><span className="pt-text-muted" >Credits:</span></Col>
              <Col span={2}>
                {canInvest ? <input type="number" style={{ display: 'inline', width: '70px' }} value={this.state.amount} onChange={e => this.changeAmount(e)} />
                  : this.state.amount}
              </Col>
              {schedule && <Col><span className="pt-text-muted" >Schedule: </span>{schedule}</Col>}
            </Row>
            <Row style={rowStyle} gutter={gutter} justify="end" align="top">
              <Button key='cancel' style={btnStyle} onClick={() => this.cancel()} text="Cancel" />
              <Button key='save' className="pt-intent-primary" style={btnStyle} onClick={() => this.save()} text="Save" />
            </Row>
          </div>
        </div>
      </Dialog>

    );
  }
}

