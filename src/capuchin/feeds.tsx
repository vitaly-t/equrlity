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

interface FeedsPanelProps { appState: AppState, panelContext: PanelContext };
interface FeedsPanelState { confirmDismissAll: boolean };

export class FeedsPanel extends React.Component<FeedsPanelProps, FeedsPanelState> {

  constructor(props: FeedsPanelProps) {
    super(props);
    this.state = { confirmDismissAll: false };
  }

  render() {
    let st = this.props.appState;
    let panelContext = this.props.panelContext
    if (st.lastErrorMessage) {
      panelContext.toast.show({ message: st.lastErrorMessage });
      Chrome.sendSyncMessage({ eventType: "Thunk", fn: st => st });  // clears error message;
    }
    let links = st.feeds;
    let linkdiv = <p>There are no current feed items.</p>
    let filteredLinks: Rpc.FeedItem[] = []
    if (links.length > 0) {
      let tagfilter = (tags: string[], source: string): boolean => {
        if (!tags) tags = [];
        let fltrs = panelContext.filters();
        for (let f of fltrs) if (tags.indexOf(f) < 0 && f !== source) return false;
        return true;
      }
      filteredLinks = links.filter(f => tagfilter(f.tags, f.source));
      let linkrows = filteredLinks.map(f => {
        let { url, comment, source, type } = f
        let dismiss = () => { Chrome.sendMessage({ eventType: "DismissFeeds", feeds: [f] }); };
        let save = () => { Chrome.sendMessage({ eventType: "DismissFeeds", feeds: [f], save: true }); };
        let onclick = () => { chrome.tabs.create({ active: true, url }); };
        let tags = <Tags.TagGroup tags={f.tags} onClick={(s) => panelContext.addFilter(s)} />;

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
            <td>{type}</td>
            <td><a href="" onClick={onclick} >{url}</a></td>
            <td><Tags.TagGroup tags={[source]} onClick={(s) => panelContext.addFilter(s)} /></td>
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
              <th>Type</th>
              <th>Link</th>
              <th>Source</th>
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
      Chrome.sendMessage({ eventType: "DismissFeeds", feeds: filteredLinks, save: true });
    }
    let vsp = <div style={{ height: "20px" }} />;
    let fltrDiv;
    if (this.state.confirmDismissAll) {
      let msg = `Dismiss all ${filteredLinks.length} feeds?`;
      let onClose = () => this.setState({ confirmDismissAll: false });
      let onYes = () => {
        let urls = filteredLinks.map(r => r.url)
        Chrome.sendMessage({ eventType: "DismissFeeds", feeds: filteredLinks });
      };
      fltrDiv = <YesNoBox message={msg} onYes={onYes} onClose={onClose} />
    }
    else {
      let cols = [];
      let filters = panelContext.filters();
      cols.push(<Col key="saveAll" ><Button disabled={filteredLinks.length === 0} className="pt-intent-success" style={btnStyle} onClick={saveAll} text="Bookmark All" /></Col>)
      cols.push(<Col key="dismissAll" ><Button disabled={filteredLinks.length === 0} className="pt-intent-danger" style={btnStyle} onClick={dismissAll} text="Dismiss All" /></Col>)
      if (filters.length > 0) {
        let feedFltrs = <Tags.TagGroup tags={filters} onRemove={(s) => panelContext.removeFilter(s)} />;
        cols.push(<Col key="feedFilters" ><Row>Showing :  {feedFltrs}</Row></Col>);
      }
      fltrDiv = <Row>{cols}</Row>;
    }

    let divStyle = { width: '100%', marginTop: 5, marginLeft: 5, padding: 6 };
    let lhcolStyle = { width: '20%' };

    return (
      <div>
        {fltrDiv}
        {vsp}
        {linkdiv}
        {vsp}
      </div>);
  }
}

