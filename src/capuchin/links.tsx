import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, Checkbox, Popover, PopoverInteractionKind, Position, Toaster } from "@blueprintjs/core";
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/contentView";
import * as Tags from '../lib/tags';
import { YesNoBox } from '../lib/dialogs';
import { sendApiRequest } from '../lib/axiosClient';

import { LinkEditor } from './linkEditor';
import { FeedsPanel } from './feeds';
import { AppState, postDeserialize } from "./AppState";
import * as Chrome from './chrome';

const toast = Toaster.create({
  position: Position.TOP,
});


interface LinksPageProps { appState: AppState };
interface LinksPageState { transferAmount: number, transferTo: string, editingItem: Rpc.UserLinkItem, filters: string[] };

export class LinksPage extends React.Component<LinksPageProps, LinksPageState> {

  constructor(props: LinksPageProps) {
    super(props);
    this.state = { transferAmount: 0, transferTo: '', editingItem: null, filters: [] };
  }

  changeTransferAmount(value: string) { this.setState({ transferAmount: parseInt(value) }); }
  changeTransferTo(value: string) { this.setState({ transferTo: value }); }

  addFilter(f: string) {
    let filters = this.state.filters;
    if (filters.indexOf(f) < 0) {
      filters = [...filters, f];
      this.setState({ filters });
    }
  }

  removeFilter(f: string) {
    let filters = [...this.state.filters];
    let i = filters.indexOf(f);
    if (i >= 0) filters.splice(i, 1);
    this.setState({ filters });
  }

  render() {
    let st = this.props.appState;
    let invs = st.shares;
    let invdiv = <p>You have no current Shares.</p>
    let btnStyle = { marginRight: "5px" };
    if (this.state.editingItem) {
      let onClose = () => this.setState({ editingItem: null });
      invdiv = <LinkEditor info={this.state.editingItem} allTags={this.props.appState.allTags} onClose={onClose} />
    }
    else if (invs.length > 0) {
      let tagfilter = (tags: string[]): boolean => {
        if (!tags) tags = [];
        let fltrs = this.state.filters;
        for (let f of fltrs) if (tags.indexOf(f) < 0) return false;
        return true;
      }

      let invrows = invs.filter(f => tagfilter(f.link.tags)).map(item => {
        let l = item.link
        let linkId = l.linkId;
        let url = Utils.linkToUrl(linkId, l.title);
        let tags = <Tags.TagGroup tags={l.tags} onClick={s => this.addFilter(s)} />;

        let redeem = () => {
          let req: Rpc.RedeemLinkRequest = { linkId };
          let errHndlr = (msg) => toast.show({ message: "Error: " + msg });

          sendApiRequest('redeemLink', req, errHndlr);  // fire and forget!!!!
        };
        let edit = () => { this.setState({ editingItem: item }) };
        let btns = [];
        btns.push(<Button key="details" onClick={edit} text="Edit" />);
        btns.push(<Button key="redeem" onClick={redeem} text={l.amount > 0 ? "Redeem" : "Delete"} />);

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
          <tr key={l.linkId} >
            <td><a href={url} target="_blank" >{url}</a></td>
            <td>{l.contentId}</td>
            <td><Checkbox disabled checked={l.isPublic} /></td>
            <td>{l.comment}</td>
            <td>{item.linkDepth}</td>
            <td>{item.viewCount}</td>
            <td>{l.amount}</td>
            <td>{tags}</td>
            <td>{pop}</td>
          </tr>
        );
      });
      invdiv = (
        <table className="pt-table pt-striped pt-bordered" >
          <thead>
            <tr>
              <th>URL</th>
              <th>Content ID</th>
              <th>Public?</th>
              <th>Comment</th>
              <th>Depth</th>
              <th>Views</th>
              <th>Balance</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invrows}
          </tbody>
        </table>
      );
    }

    let vsp = <div style={{ height: "20px" }} />;

    let fltrDiv = null;
    if (this.state.filters.length > 0) {
      let fltrs = <Tags.TagGroup tags={this.state.filters} onRemove={(s) => this.removeFilter(s)} />;
      fltrDiv = <div>{vsp}<Row>Showing :  {fltrs}</Row></div>;
    }

    let divStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let lhcolStyle = { width: '20%' };
    let transfer = () => {
      let amount = this.state.transferAmount;
      let transferTo = this.state.transferTo;
      let req: Rpc.TransferCreditsRequest = { transferTo, amount };
      if (amount > 0 && transferTo) {
        Chrome.sendMessage({ eventType: "TransferCredits", req });
        this.setState({ transferAmount: 0 });
      }
    };

    let transferDiv = (
      <div>
        {vsp}
        <p>If you wish, you can transfer credits to another user.</p>
        <div style={divStyle} >
          <div style={{ display: 'inline' }}>Amount to Transfer: </div>
          <input type="number" style={{ display: 'inline', height: 24, marginLeft: 20, marginTop: 6, width: '100px' }}
            value={this.state.transferAmount} onChange={e => this.changeTransferAmount(e.target.value)} />
          <div style={{ display: 'inline', marginLeft: 20 }}>Transfer To: </div>
          <input type="text" style={{ display: 'inline', height: 24, marginLeft: 20, marginTop: 6, width: '200px' }}
            value={this.state.transferTo} onChange={e => this.changeTransferTo(e.target.value)} />
          <Button key='transfer' className="pt-intent-primary" style={{ display: 'inline', marginLeft: 20 }} onClick={() => transfer()} text="Transfer" />
        </div>
      </div>);

    return (
      <div style={{ margin: "16px" }}>
        <FeedsPanel appState={st} />
        <h4>Shares: </h4>
        {fltrDiv}
        {vsp}
        {invdiv}
        {vsp}
        <h6>Your Current Wallet Balance is : {st.user.credits} credits.</h6>
        {transferDiv}
        {vsp}
      </div>);
  }
}

function render(state: AppState) {
  let elem = document.getElementById('app')
  if (!elem) console.log("cannot get app element");
  else {
    ReactDOM.render(<LinksPage appState={state} />, elem);
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

