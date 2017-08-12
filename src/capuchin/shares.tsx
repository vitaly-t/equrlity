import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, Checkbox, Popover, PopoverInteractionKind, Position, IToaster } from "@blueprintjs/core";
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { btnStyle, lhcolStyle } from "../lib/constants";
import { Row, Col } from '../lib/components';
import * as Tags from '../lib/tags';
import { YesNoBox } from '../lib/dialogs';
import { sendApiRequest } from '../lib/axiosClient';

import { LinkEditor } from './linkEditor';
import { AppState, postDeserialize } from "./AppState";
import { PanelContext } from "./home";
import * as Chrome from './chrome';

interface SharesPanelProps { appState: AppState, panelContext: PanelContext };
interface SharesPanelState { editingItem: Rpc.UserLinkItem };

export class SharesPanel extends React.Component<SharesPanelProps, SharesPanelState> {

  constructor(props: SharesPanelProps) {
    super(props);
    this.state = { editingItem: null };
  }

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
      let tagfilter = (tags: string[], type: Dbt.contentType): boolean => {
        if (!tags) tags = [];
        let fltrs = panelContext.filters();
        for (let f of fltrs) if (tags.indexOf(f) < 0 && f !== type) return false;
        return true;
      }

      let invrows = invs.filter(f => tagfilter(f.link.tags, f.type)).map(item => {
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
            <td>{OxiDate.timeAgo(new Date(l.created))}</td>
            <td><a href={url} target="_blank" >{url}</a></td>
            <td><Tags.TagGroup tags={[item.type]} onClick={(s) => panelContext.addFilter(s)} /></td>
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
              <th>Created</th>
              <th>URL</th>
              <th>Type</th>
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

    let filters = panelContext.filters();
    let fltrs = <Tags.TagGroupEditor creatable={false} tags={filters} allTags={st.allTags} onChange={filters => panelContext.setFilters(filters)} />;

    return (
      <div>
        <Row align="middle" ><span>Showing : </span><div style={{ display: 'inline-block' }}>{fltrs}</div></Row>
        {vsp}
        {invdiv}
      </div>);
  }
}

