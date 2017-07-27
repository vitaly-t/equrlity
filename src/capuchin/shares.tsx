import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, Checkbox, Popover, PopoverInteractionKind, Position, IToaster } from "@blueprintjs/core";
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/constants";
import * as Tags from '../lib/tags';
import { YesNoBox } from '../lib/dialogs';
import { sendApiRequest } from '../lib/axiosClient';

import { LinkEditor } from './linkEditor';
import { AppState, postDeserialize } from "./AppState";
import { PanelContext } from "./home";
import * as Chrome from './chrome';

interface SharesPanelProps { appState: AppState, panelContext: PanelContext };
interface SharesPanelState { transferAmount: number, transferTo: string, editingItem: Rpc.UserLinkItem };

export class SharesPanel extends React.Component<SharesPanelProps, SharesPanelState> {

  constructor(props: SharesPanelProps) {
    super(props);
    this.state = { transferAmount: 0, transferTo: '', editingItem: null };
  }

  changeTransferAmount(value: string) { this.setState({ transferAmount: parseInt(value) }); }
  changeTransferTo(value: string) { this.setState({ transferTo: value }); }

  render() {
    let st = this.props.appState;
    let panelContext = this.props.panelContext;
    let { vsp, toast } = panelContext;
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
        let fltrs = panelContext.filters();
        for (let f of fltrs) if (tags.indexOf(f) < 0) return false;
        return true;
      }

      let invrows = invs.filter(f => tagfilter(f.link.tags)).map(item => {
        let l = item.link
        let linkId = l.linkId;
        let url = Utils.linkToUrl(linkId, l.title);
        let tags = <Tags.TagGroup tags={l.tags} onClick={s => panelContext.addFilter(s)} />;

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


    let fltrDiv = null;
    let filters = panelContext.filters();
    if (filters.length > 0) {
      let fltrs = <Tags.TagGroup tags={filters} onRemove={(s) => panelContext.removeFilter(s)} />;
      fltrDiv = <div>{vsp}<Row>Showing :  {fltrs}</Row></div>;
    }

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
        <div style={rowStyle} >
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

