import * as React from 'react';
import { Url, format } from 'url';
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-autosize-textarea';
import { Button, Intent } from "@blueprintjs/core";

import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import { TagGroupEditor } from '../lib/tags';

import * as Chrome from './chrome';
import { AppState, expandedUrl, isWaiting, getLinked } from "./AppState";

export interface PopupPanelProps { appState?: AppState; serverMessage?: string };
export interface PopupPanelState { url: Dbt.urlString, promoteAmount: number, title: string, comment: string, tags: string[] };

export class PopupPanel extends React.Component<PopupPanelProps, PopupPanelState> {

  constructor(props) {
    super(props);
    this.state = { promoteAmount: 0, url: props.appState.activeUrl, title: '', comment: '', tags: [] };
  }

  changePromoteAmount(value: string) {
    this.setState({ promoteAmount: parseInt(value) });
  }

  changeUrl(url: string) {
    this.setState({ url });
  }

  changeTitle(title: string) {
    this.setState({ title });
  }

  changeComment(comment: string) {
    this.setState({ comment });
  }

  changeTags(tags: string[]) {
    this.setState({ tags });
    Chrome.sendSyncMessage({ eventType: "SaveTags", tags })
  }

  render() {
    let props = this.props;
    if (props.serverMessage) {
      console.log("rendering server message...");
      return <div>Server error: {props.serverMessage} </div>;
    }
    let st = props.appState;
    let curl = st.activeUrl
    /*
    if (curl && isWaiting(st, curl)) {
      console.log("rendering waiting for response...");
      return <div>Waiting for response from Server</div>;
    }
    */
    let launch = (page) => Chrome.sendMessage({ eventType: "LaunchPage", page });
    let linksAction = () => launch('links');
    let usersAction = () => launch('users');
    let contentsAction = () => launch('contents');
    let settingsAction = () => launch('settings');
    let gutter = 20;
    let lspan = 3;
    let rspan = 9;
    let btnStyle = { marginRight: 10 };
    let rowStyle = { marginBottom: 10 };
    let btns = [
      <Button key="Close" style={btnStyle} onClick={() => window.close()} text="Close" />,
      <Button key="Settings" style={btnStyle} className="pt-intent-success" onClick={settingsAction} text="Settings" />,
      <Button key="Investments" style={btnStyle} className="pt-intent-success" onClick={linksAction} text="Investments" />,
      //<Button key="People" style={btnStyle} className="pt-intent-success" onClick={usersAction} text="People" />,
      <Button key="Contents" style={btnStyle} className="pt-intent-success" onClick={contentsAction} text="Contents" />,
    ]
    let pnl = <div>
      <p>No active URL found</p>
    </div>
    if (st.lastErrorMessage) pnl = <div>Error: {st.lastErrorMessage}</div>
    if (curl) {
      let tgt = expandedUrl(st);
      let linkInfo = getLinked(st, curl);
      let lbl = "Save";
      let saveaction = () => {
        let amount = this.state.promoteAmount;
        let { title, comment, tags, url } = this.state;
        Chrome.sendMessage({ eventType: "PromoteLink", url, amount, title, comment, tags });
      }
      let infoDiv = null;
      let promTxt = null;
      if (this.state.promoteAmount > 0) {
        lbl = linkInfo ? (linkInfo.linkPromoter === st.moniker ? "Re-Invest" : "Re-Promote") : "Promote";
        if (linkInfo) {
          infoDiv = (
            <Row style={rowStyle} gutter={gutter} align="top">
              <Col>Promoted by: {linkInfo.linkPromoter}</Col>
              <Col>Link depth : {linkInfo.linkDepth}</Col>
            </Row>
          )
        }
        let costPerView = linkInfo ? linkInfo.linkDepth + 1 : 1;
        promTxt = `(= max. ${Math.floor(this.state.promoteAmount / costPerView)} promotions)`;
      }
      btns.push(<Button key="Save" style={btnStyle} className="pt-intent-primary" onClick={saveaction} text={lbl} />);
      pnl = (<div>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}>Source URL : </Col>
          <Col span={rspan}><TextareaAutosize style={{ width: '100%' }} value={this.state.url} onChange={(e) => this.changeUrl(e.target.value)} /></Col>
        </Row>
        {infoDiv}
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}>Investment amount</Col>
          <Col span={2}><input style={{ width: '100%' }} type="number" max={st.credits} value={this.state.promoteAmount} onChange={(e) => this.changePromoteAmount(e.target.value)} /></Col>
          <Col span={3}> / {st.credits} available.</Col>
          <Col span={4}>{promTxt}</Col>
        </Row>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}>Link Description: </Col>
          <Col span={rspan}><TextareaAutosize style={{ width: '100%' }} value={this.state.title} onChange={(e) => this.changeTitle(e.target.value)} /></Col>
        </Row>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}>Comment:</Col>
          <Col span={rspan}><TextareaAutosize style={{ width: '100%' }} value={this.state.comment} onChange={(e) => this.changeComment(e.target.value)} /></Col>
        </Row>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}>Tags:</Col>
          <Col span={rspan}><TagGroupEditor tags={this.state.tags} allTags={this.props.appState.allTags} onChange={(tags) => this.changeTags(tags)} /></Col>
        </Row>
      </div>);
    }
    let btnRow = (
      <Row style={rowStyle} gutter={gutter} justify="end" align="top">
        {btns}
      </Row>
    );
    return <div>
      {pnl}
      {btnRow}
    </div >
  }
}

