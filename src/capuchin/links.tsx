import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, Checkbox, Popover, PopoverInteractionKind, Position } from "@blueprintjs/core";
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

import { LinkEditor } from './linkEditor';
import { AppState, postDeserialize } from "./AppState";
import * as Chrome from './chrome';

interface LinksPageProps { appState: AppState };
interface LinksPageState { transferAmount: number, transferTo: string, editingItem: Rpc.UserLinkItem, filters: string[], feedFilters: string[], confirmDismissAll: boolean };

export class LinksPage extends React.Component<LinksPageProps, LinksPageState> {

  constructor(props: LinksPageProps) {
    super(props);
    this.state = { transferAmount: 0, transferTo: '', editingItem: null, filters: [], feedFilters: [], confirmDismissAll: false };
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

  addFeedFilter(f: string) {
    let feedFilters = this.state.feedFilters;
    if (feedFilters.indexOf(f) < 0) {
      feedFilters = [...feedFilters, f];
      this.setState({ feedFilters });
    }
  }

  removeFeedFilter(f: string) {
    let feedFilters = [...this.state.feedFilters];
    let i = feedFilters.indexOf(f);
    if (i >= 0) feedFilters.splice(i, 1);
    this.setState({ feedFilters });
  }

  render() {
    let st = this.props.appState;
    let invs = st.investments;
    let invdiv = <p>You have no current squawks.</p>
    let btnStyle = { marginRight: "5px" };
    if (this.state.editingItem) {
      let onClose = () => this.setState({ editingItem: null });
      invdiv = <LinkEditor info={this.state.editingItem} allTags={this.props.appState.allTags} onClose={onClose} />
    }
    else if (invs.length > 0) {
      let invrows = invs.map(item => {
        let l = item.link
        let linkId = l.linkId;
        let url = Utils.linkToUrl(linkId, l.title);
        let tags = <Tags.TagGroup tags={l.tags} onClick={s => this.addFilter(s)} />;

        let redeem = () => { Chrome.sendMessage({ eventType: "RedeemLink", linkId }); };
        let redeemText = l.amount > 0 ? "Redeem" : "Delete";
        let btns = [<Button key="redeem" onClick={redeem} text={redeemText} />];
        let edit = () => { this.setState({ editingItem: item }) };
        btns.push(<Button key="details" onClick={edit} text="Details" />);

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

    let links = st.feed;
    let linkdiv = <p>There are no current squawks for you.</p>
    let filteredLinks: Rpc.FeedItem[] = []
    if (links.length > 0) {
      let tagfilter = (tags: string[], source: string): boolean => {
        if (!tags) tags = [];
        let fltrs = this.state.feedFilters;
        for (let f of fltrs) if (tags.indexOf(f) < 0 && f !== source) return false;
        return true;
      }
      filteredLinks = links.filter(f => tagfilter(f.tags, f.source));
      let linkrows = filteredLinks.map(f => {
        let { url, comment, source } = f
        let dismiss = () => { Chrome.sendMessage({ eventType: "DismissSquawks", urls: [url] }); };
        let save = () => { Chrome.sendMessage({ eventType: "DismissSquawks", urls: [url], save: true }); };
        let onclick = () => { chrome.tabs.create({ active: true, url }); };
        let tags = <Tags.TagGroup tags={f.tags} onClick={(s) => this.addFeedFilter(s)} />;

        let btngrp = (
          <div className="pt-button-group pt-vertical pt-align-left pt-large">
            <Button onClick={save} text="Bookmark" />
            <Button onClick={dismiss} text="Dismiss" />
          </div>
        );
        let pop = (<Popover content={btngrp} popoverClassName="pt-minimal" interactionKind={PopoverInteractionKind.HOVER} position={Position.BOTTOM} >
          <Button iconName="pt-icon-cog" text="" />
        </Popover>
        );


        return (
          <tr key={url} >
            <td><a href="" onClick={onclick} >{url}</a></td>
            <td><Tags.TagGroup tags={[source]} onClick={(s) => this.addFeedFilter(s)} /></td>
            <td>{comment}</td>
            <td>{tags}</td>
            <td>{pop}</td>
          </tr>
        );
      });
      linkdiv = (
        <table className="pt-table pt-striped pt-bordered">
          <thead>
            <tr>
              <th>Link</th>
              <th>Squawker</th>
              <th>Comment</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {linkrows}
          </tbody>
        </table>
      );
    }

    let dismissAll = () => {
      this.setState({ confirmDismissAll: true });
    }
    let saveAll = () => {
      let urls = filteredLinks.map(r => r.url);
      this.setState({ feedFilters: [] });
      Chrome.sendMessage({ eventType: "DismissSquawks", urls, save: true });
    }
    let vsp = <div style={{ height: "20px" }} />;
    let feedFltrDiv;
    if (this.state.confirmDismissAll) {
      let msg = `Dismiss all ${filteredLinks.length} squawks?`;
      let onClose = () => this.setState({ confirmDismissAll: false });
      let onYes = () => {
        let urls = filteredLinks.map(r => r.url)
        this.setState({ feedFilters: [] });
        Chrome.sendMessage({ eventType: "DismissSquawks", urls });
      };
      feedFltrDiv = <YesNoBox message={msg} onYes={onYes} onClose={onClose} />
    }
    else {
      let cols = [];
      cols.push(<Col key="saveAll" ><Button disabled={filteredLinks.length === 0} className="pt-intent-success" style={btnStyle} onClick={saveAll} text="Bookmark All" /></Col>)
      cols.push(<Col key="dismissAll" ><Button disabled={filteredLinks.length === 0} className="pt-intent-danger" style={btnStyle} onClick={dismissAll} text="Dismiss All" /></Col>)
      if (this.state.feedFilters.length > 0) {
        let feedFltrs = <Tags.TagGroup tags={this.state.feedFilters} onRemove={(s) => this.removeFeedFilter(s)} />;
        cols.push(<Col key="feedFilters" ><Row>Showing :  {feedFltrs}</Row></Col>);
      }
      feedFltrDiv = <Row>{cols}</Row>;
    }

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
        <p>If you wish, you can transfer PseudoQoins to another user.</p>
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
      <div>
        <h4>Squawks Overheard: </h4>
        {vsp}
        {feedFltrDiv}
        {vsp}
        {linkdiv}
        {vsp}
        <h4>Squawks Emitted: </h4>
        {fltrDiv}
        {vsp}
        {invdiv}
        {vsp}
        <h6>Your Current Wallet Balance is : {st.credits} PseudoQoins.</h6>
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

