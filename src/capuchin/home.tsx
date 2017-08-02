import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Position, Toaster, IToaster, Button, Popover, PopoverInteractionKind, Tooltip } from "@blueprintjs/core";
import { Url, format } from 'url';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import * as OxiGen from '../gen/oxigen';
import { sendApiRequest } from '../lib/axiosClient';

import { AppState, postDeserialize } from "./AppState";
import * as Chrome from './chrome';

import { FeedsPanel } from './feeds';
import { SharesPanel } from './shares';
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
  addFilter: (t: string) => void;
  removeFilter: (t: string) => void;
  vsp: JSX.Element;
}

type Panel = "Feeds" | "Shares" | "Contents" | "Settings"
interface HomePageProps { appState: AppState };
interface HomePageState { panel: Panel, filters: string[], panelContext: PanelContext };

export class HomePage extends React.Component<HomePageProps, HomePageState> {

  constructor(props: HomePageProps) {
    super(props);
    let vsp = <div style={{ height: "20px" }} />;

    let panelContext = {
      toast, filters: () => this.state.filters, addFilter: s => this.addFilter(s), removeFilter: s => this.removeFilter(s), vsp
    }
    this.state = { panel: "Feeds", filters: [], panelContext };
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
    let st = this.props.appState;
    let panelContext = this.state.panelContext
    switch (this.state.panel) {
      case "Feeds": return <FeedsPanel appState={st} panelContext={panelContext} />;
      case "Shares": return <SharesPanel appState={st} panelContext={panelContext} />;
      case "Contents": return <ContentsPanel appState={st} panelContext={panelContext} />;
      case "Settings": return <SettingsPanel appState={st} panelContext={panelContext} />;
    }
  }

  render() {
    let btns = [];
    let reload = () => {
      let { publicKey } = this.props.appState;
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
      <Button iconName="pt-icon-cog" text="" />
    </Popover>
    );

    return <div>
      <nav className="pt-navbar pt-dark pt-fixed-top">
        <div className="pt-navbar-group pt-align-left">
          <div className="pt-navbar-heading"><h2 style={{ color: "#48AFF0" }}><b><i>eqURLity</i></b></h2></div>
        </div>
        <div className="pt-navbar-group pt-align-right">
          <button className="pt-button pt-minimal pt-icon-notifications" onClick={() => this.setPanel("Feeds")} >Feeds</button>
          <button className="pt-button pt-minimal pt-icon-document-share" onClick={() => this.setPanel("Shares")} >Shares</button>
          <button className="pt-button pt-minimal pt-icon-document" onClick={() => this.setPanel("Contents")} >Contents</button>
          <button className="pt-button pt-minimal pt-icon-user" onClick={() => this.setPanel("Settings")} >Settings</button>
          {pop}
        </div>
      </nav>
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

