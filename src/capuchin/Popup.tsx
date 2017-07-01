import * as React from 'react';
import { Url, format } from 'url';
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-autosize-textarea';
import { Button, Intent, Toaster, Position, Popover, PopoverInteractionKind } from "@blueprintjs/core";

import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import { TagGroupEditor, TagSelectOption } from '../lib/tags';

import * as Chrome from './chrome';
import { AppState, isWaiting, getBookmark, prepareUrl } from "./AppState";

const toast = Toaster.create({
  className: "popup-toaster",
  position: Position.TOP,
});

export interface BookmarkPanelProps { appState: AppState };
export interface BookmarkPanelState { url: Dbt.urlString, title: string, comment: string, tags: string[] };
export class BookmarkPanel extends React.Component<BookmarkPanelProps, BookmarkPanelState> {

  constructor(props: BookmarkPanelProps) {
    super(props);
    let url = props.appState.activeUrl
    let st: BookmarkPanelState = { url, title: '', comment: '', tags: [] };
    if (url) {
      let cont = getBookmark(props.appState, url);
      if (cont) st = { url, title: cont.title, comment: cont.content, tags: cont.tags };
      else {
        url = prepareUrl(url);
        let { matchedTags } = props.appState;
        if (matchedTags && url in props.appState.matchedTags) st = { ...st, tags: matchedTags[url] };
      }
    }
    this.state = st;
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
    let st = props.appState;
    let curl = st.activeUrl

    let gutter = 20;
    let lspan = 2;
    let rspan = 10;
    let btnStyle = { marginRight: 10 };
    let rowStyle = { marginBottom: 10 };
    let saveaction = (squawk: boolean) => {
      let { title, comment, tags, url } = this.state;
      Chrome.sendMessage({ eventType: "BookmarkLink", url, title, comment, tags, squawk });
      window.close();
    }
    let btns = [
      <Button key="Close" style={btnStyle} onClick={() => window.close()} text="Close" />,
      <Button key="Squawk" style={btnStyle} className="pt-intent-success" onClick={() => saveaction(true)} text="Squawk" />,
      <Button key="Save" style={btnStyle} className="pt-intent-primary" onClick={() => saveaction(false)} text="Save" />
    ]

    return (<div className="pt-elevation-0" style={{ width: "100%", height: "100%", backgroundColor: "#F5F8FA" }}>
      <div style={{ margin: "16px" }}>
        <Row style={rowStyle} gutter={gutter} justify="center">
          <h4 className="pt-text-muted" style={{ marginTop: "16px" }}>Bookmark Details</h4>
        </Row>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}> <span className="pt-text-muted" >URL:</span></Col>
          <Col span={rspan}><TextareaAutosize disabled={!curl} className="pt-elevation-2" style={{ width: '100%' }} value={this.state.url} /></Col>
        </Row>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}> <span className="pt-text-muted" >Title:</span></Col>
          <Col span={rspan}><TextareaAutosize className="pt-elevation-2" style={{ width: '100%' }} value={this.state.title} onChange={(e) => this.changeTitle(e.target.value)} /></Col>
        </Row>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}> <span className="pt-text-muted" >Comment:</span></Col>
          <Col span={rspan}><TextareaAutosize className="pt-elevation-2" style={{ width: '100%' }} value={this.state.comment} onChange={(e) => this.changeComment(e.target.value)} /></Col>
        </Row>
        <Row style={rowStyle} gutter={gutter} align="top">
          <Col span={lspan}> <span className="pt-text-muted" >Tags:</span></Col>
          <Col span={rspan}><TagGroupEditor tags={this.state.tags} creatable={true} allTags={this.props.appState.allTags} onChange={(tags) => this.changeTags(tags)} /></Col>
        </Row>
        <Row style={rowStyle} gutter={gutter} justify="end" align="top">
          {btns}
        </Row>
      </div>
    </div>);
  }
}

export interface PopupPanelProps { appState: AppState };
export interface PopupPanelState { macfix: boolean };
export class PopupPanel extends React.Component<PopupPanelProps, PopupPanelState> {
  constructor(props) {
    super(props)
    this.state = { macfix: false };
  }

  // grass skirts afire - see if this fixed the Mac rendering problem.
  componentDidMount() {
    setTimeout(() => this.setState({ macfix: true }), 50);
  }

  render() {
    let props = this.props;
    let st = props.appState;
    let curl = st.activeUrl

    let launch = (page) => Chrome.sendMessage({ eventType: "LaunchPage", page });
    let linksAction = () => launch('links');
    let usersAction = () => launch('users');
    let contentsAction = () => launch('contents');
    let settingsAction = () => launch('settings');
    let gutter = 20;
    let btnStyle = { marginRight: 10 };
    let rowStyle = { marginBottom: 10 };
    let btns = [
      <Button key="Settings" style={btnStyle} className="pt-intent-success" onClick={settingsAction} text="Settings" />,
      <Button key="Investments" style={btnStyle} className="pt-intent-success" onClick={linksAction} text="Squawks" />,
      //<Button key="People" style={btnStyle} className="pt-intent-success" onClick={usersAction} text="People" />,
      <Button key="Contents" style={btnStyle} className="pt-intent-success" onClick={contentsAction} text="Contents" />,
    ]
    if (!curl) btns.unshift(<Button key="Close" style={btnStyle} onClick={() => window.close()} text="Close" />);

    if (st.lastErrorMessage) toast.show({ message: "Error: " + st.lastErrorMessage });
    return <div>
      <Row style={rowStyle} gutter={gutter} justify="space-between">
        <Col span={3}><h2 style={{ color: "#48AFF0" }}><b><i>PseudoQURL</i></b></h2></Col>
        <Col span={9}>
          <Row style={rowStyle} gutter={gutter} justify="end">{btns}</Row>
        </Col>
      </Row>
      {curl && <BookmarkPanel appState={this.props.appState} />}
      {this.state.macfix && <p />}
    </div>
  }
}

