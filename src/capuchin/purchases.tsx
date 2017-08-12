import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, ProgressBar, Checkbox, Position, IToaster, Popover, PopoverInteractionKind } from "@blueprintjs/core";
import * as Dropzone from 'react-dropzone';
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import * as OxiGen from '../gen/oxigen';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/constants";
import { Panel, Row, Col, Label } from "../lib/components";
import * as Tags from '../lib/tags';
import * as Hasher from '../lib/contentHasher';
import { YesNoBox } from '../lib/dialogs';
import { uploadRequest, signData, sendApiRequest } from "../lib/axiosClient";
import buildWaveform from '../lib/buildWaveform';
import { TrackInfoEditor, TrackInfoViewer } from '../lib/trackinfo';

import { AppState, postDeserialize, userNameFromId } from "./AppState";
import * as Comms from './Comms';
import * as Chrome from './chrome';
import { ContentEditor } from './contentEditor';
import { PanelContext } from "./home";

type UploadProgress = { fileName: string, progress: number }

const gutter = 20;

interface PurchasesPanelProps { appState: AppState, panelContext: PanelContext };
interface PurchasesPanelState { promotingPurchase?: Dbt.Content, confirmDeletePurchase?: Dbt.Content };

export class PurchasesPanel extends React.Component<PurchasesPanelProps, PurchasesPanelState> {

  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    let st = this.props.appState;
    let panelContext = this.props.panelContext
    let { vsp } = panelContext;
    let contsdiv = <p>You do not currently have any purchased contents.</p>
    if (this.state.confirmDeletePurchase) {
      let msg = "Warning: Deleting a Purchase Item is irreversible. Are you sure you wish to Proceed?";
      let onClose = () => this.setState({ confirmDeletePurchase: null });
      let contentId = this.state.confirmDeletePurchase.contentId;
      let onYes = () => Chrome.sendMessage({ eventType: "RemoveContent", req: { contentId } });
      contsdiv = <YesNoBox message={msg} onYes={onYes} onClose={onClose} />
    }
    else if (this.state.promotingPurchase) {
      let onClose = () => this.setState({ promotingPurchase: null });
      contsdiv = <SharePurchase info={this.state.promotingPurchase} appState={this.props.appState} onClose={onClose} toast={panelContext.toast} />
    }
    else if (st.purchases.length > 0) {
      let tagfilter = (tags: string[], typ: string, source: Dbt.userName): boolean => {
        if (!tags) tags = [];
        let fltrs = panelContext.filters();
        for (let f of fltrs) if (tags.indexOf(f) < 0 && f !== typ) return false;
        return true;
      }
      let rows = st.purchases.filter(p => tagfilter(p.tags, p.contentType, userNameFromId(st, p.source))).map(p => {
        let url = p.contentType === 'bookmark' ? p.url : Utils.contentToUrl(p.contentId)
        let tags = <Tags.TagGroup tags={p.tags} onClick={(s) => panelContext.addFilter(s)} />;

        let btns = [];

        let share = () => { this.setState({ promotingPurchase: p }) };
        btns.push(<Button key="share" onClick={share} text="Share" />);

        let remove = () => { this.setState({ confirmDeletePurchase: p }) };
        btns.push(<Button key="remove" onClick={remove} text="Delete" />);

        let btngrp = (
          <div className="pt-button-group pt-vertical pt-align-left pt-large">
            {btns}
          </div>
        );
        let pop = (<Popover content={btngrp} popoverClassName="pt-minimal" interactionKind={PopoverInteractionKind.HOVER} position={Position.BOTTOM} >
          <Button iconName="pt-icon-cog" text="" />
        </Popover>
        );
        return (
          <tr key={p.contentId} >
            <td>{OxiDate.timeAgo(new Date(p.created))}</td>
            <td><Tags.TagGroup tags={[p.contentType]} onClick={(s) => panelContext.addFilter(s)} /></td>
            <td><a href={url} target="_blank" >{url}</a></td>
            <td><Tags.TagGroup tags={[userNameFromId(st, p.source)]} onClick={(s) => panelContext.addFilter(s)} /></td>
            <td>{p.title}</td>
            <td>{tags}</td>
            <td>{pop}</td>
          </tr>
        );
      });
      contsdiv = (
        <table className="pt-table pt-striped pt-bordered" >
          <thead>
            <tr>
              <th>Created</th>
              <th>Type</th>
              <th>Link</th>
              <th>Source</th>
              <th>Title</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>);
    }

    let filters = panelContext.filters();
    let fltrs = <Tags.TagGroupEditor creatable={false} tags={filters} allTags={st.allTags} onChange={filters => panelContext.setFilters(filters)} />;
    return (
      <div>
        <Row align="middle" ><span>Showing : </span><div style={{ display: 'inline-block' }}>{fltrs}</div></Row>
        {vsp}
        {contsdiv}
      </div>);
  }
}

interface SharePurchaseProps { appState: AppState, info: Dbt.Content, onClose: () => void, toast: IToaster }
interface SharePurchaseState { title: string, comment: string, tags: string[], isOpen: boolean, amount: number, stringSchedule: string, isPublic: boolean }
class SharePurchase extends React.Component<SharePurchaseProps, SharePurchaseState> {

  constructor(props: SharePurchaseProps) {
    super(props);
    let tags = props.info.tags || [];
    tags.unshift(props.info.contentType);
    let paymentSchedule = this.isMediaType() ? Utils.defaultPaymentSchedule() : [];
    let stringSchedule = paymentSchedule.map(i => i.toString()).join();
    this.state = { isOpen: true, amount: 0, title: props.info.title, tags, comment: '', stringSchedule, isPublic: false };
  }

  isMediaType() { return ['audio', 'video'].indexOf(this.props.info.contentType) >= 0; }

  changeTags(e) { this.setState({ tags: e.target.value }); }
  changeComment(e) { this.setState({ comment: e.target.value }); }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  save() {
    let { title, tags, comment } = this.state;
    let paymentSchedule = [];
    let info = this.props.info;
    let req: Rpc.ShareContentRequest = { contentId: info.contentId, title, comment, tags, amount: 0, signature: '', paymentSchedule };
    Comms.sendShareContent(this.props.appState, req);
    this.close();
  }

  public render() {
    if (!this.state.isOpen) return null;
    let pubdiv = null;
    let ttl = "Share Purchase"
    let lspan = 2;
    return (
      <Dialog iconName="share" style={{ width: '600px' }} isOpen={this.state.isOpen} title={ttl} onClose={() => this.close()} >
        <Panel>
          <Row>
            <Label span={lspan} >Title:</Label>
            <Col span={7}>{this.state.title}</Col>
          </Row>
          <Row>
            <Label span={lspan}>Comment:</Label>
            <Col span={12 - lspan}>
              <textarea className="pt-input pt-fill" style={{ height: "100px" }} value={this.state.comment} onChange={e => this.changeComment(e)} />
            </Col>
          </Row>
          <Row align="center">
            <Label span={lspan}>Tags:</Label>
            <Col span={10}>
              <Tags.TagGroupEditor tags={this.state.tags} creatable={true} allTags={this.props.appState.allTags} onChange={tags => this.changeTags(tags)} />
            </Col>
          </Row>
          <Row justify="end">
            <Button style={btnStyle} text="Cancel" onClick={() => this.close()} />
            <Button style={btnStyle} intent={Intent.PRIMARY} onClick={() => this.save()} text="Share" />
          </Row>
        </Panel>
      </Dialog >
    );
  }
}

