import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Position, Toaster, IToaster, Button, Popover, PopoverInteractionKind, Tooltip } from "@blueprintjs/core";
import { Url, format } from 'url';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import { NavBar } from '../lib/components';
import * as OxiDate from '../lib/oxidate';
import * as OxiGen from '../gen/oxigen';
import { sendApiRequest } from '../lib/axiosClient';

import { AppState, postDeserialize } from "./AppState";
import * as Chrome from './chrome';

import { FeedsPanel } from './feeds';
import { SharesPanel } from './shares';
import { PurchasesPanel } from './purchases';
import { ContentsPanel } from './contents';
import { SettingsPanel } from './settings';

const gutter = 20;

const toast = Toaster.create({
  className: "home-toaster",
  position: Position.TOP,
});

export type PanelContext = {
  toast: IToaster;
  filters: () => string[];
  setFilters: (a: string[]) => void;
  addFilter: (t: string) => void;
  removeFilter: (t: string) => void;
  vsp: JSX.Element;
}

type Panel = "Feeds" | "Shares" | "Purchases" | "Contents" | "Settings"
interface HomePageProps { appState: AppState };
interface HomePageState { panel: Panel, filters: string[], panelContext: PanelContext };

export class HomePage extends React.Component<HomePageProps, HomePageState> {

  constructor(props: HomePageProps) {
    super(props);
    let vsp = <div style={{ height: "20px" }} />;

    let panelContext = {
      toast, filters: () => this.state.filters, setFilters: a => this.setFilters(a), addFilter: s => this.addFilter(s), removeFilter: s => this.removeFilter(s), vsp
    }
    this.state = { panel: "Feeds", filters: [], panelContext };
  }

  setFilters(filters: string[]) {
    this.setState({ filters });
  }

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

  setPanel(panel: Panel) { this.setState({ panel }) };

  getPanel() {
    let appState = this.props.appState;
    let panelContext = this.state.panelContext;
    switch (this.state.panel) {
      case "Feeds": return <FeedsPanel appState={appState} panelContext={panelContext} />;
      case "Shares": return <SharesPanel appState={appState} panelContext={panelContext} />;
      case "Purchases": return <PurchasesPanel appState={appState} panelContext={panelContext} />;
      case "Contents": return <ContentsPanel appState={appState} panelContext={panelContext} />;
      case "Settings": return <SettingsPanel appState={appState} panelContext={panelContext} />;
    }
  }

  render() {
    let btns = [];
    let { publicKey, user } = this.props.appState;
    let reload = () => {
      let req: Rpc.InitializeRequest = { publicKey };
      sendApiRequest("initialize", req);
    }
    btns.push(<Tooltip content={<span>Refresh local data from Server.</span>} inline={true} position={Position.LEFT}>
      <Button key="Reload" text="Reload" onClick={() => reload()} />
    </Tooltip>);

    let btngrp = (
      <div className="pt-button-group pt-vertical pt-align-left pt-large">
        {btns}
      </div>
    );
    let pop = (<Popover content={btngrp} popoverClassName="pt-minimal" interactionKind={PopoverInteractionKind.HOVER} position={Position.BOTTOM} >
      <button className="pt-button pt-minimal pt-icon-cog" />
    </Popover>
    );

    let navbtns = [
      <button className="pt-button pt-minimal pt-icon-notifications" onClick={() => this.setPanel("Feeds")} >Feeds</button>,
      <button className="pt-button pt-minimal pt-icon-document-share" onClick={() => this.setPanel("Shares")} >Shares</button>,
      <button className="pt-button pt-minimal pt-icon-saved" onClick={() => this.setPanel("Purchases")} >Purchases</button>,
      <button className="pt-button pt-minimal pt-icon-document" onClick={() => this.setPanel("Contents")} >Contents</button>,
      <button className="pt-button pt-minimal pt-icon-user" onClick={() => this.setPanel("Settings")} >{user.userName}</button>,
      pop
    ];

    return <div>
      <NavBar buttons={navbtns} />
      <div style={{ marginTop: "60px" }} >
        < h3 > {this.state.panel}</h3>
        {this.getPanel()}
      </div>
    </div >
  }
}

function render(state: AppState) {
  //console.log("render called for settings");
  let elem = document.getElementById('app')
  if (!elem) console.log("cannot get app element");
  else {
    ReactDOM.render(<HomePage appState={state} />, elem);
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

