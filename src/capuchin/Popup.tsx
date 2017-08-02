import * as React from 'react';
import { Url, format } from 'url';
import { Col } from 'react-simple-flex-grid';
import { Button, Intent, Toaster, Position, Popover, PopoverInteractionKind } from "@blueprintjs/core";

import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import * as Tags from '../lib/tags';
import * as Constants from '../lib/constants';
import { Panel, Row, Label, TextAuto } from '../lib/components';

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
  }

  render() {
    let props = this.props;
    let st = props.appState;
    let curl = st.activeUrl

    let { btnStyle, rowStyle, gutter } = Constants;
    let lspan = 2;
    let rspan = 10;
    let saveaction = (share: boolean) => {
      let { title, comment, tags, url } = this.state;
      Chrome.sendMessage({ eventType: "BookmarkLink", url, title, comment, tags, share });
      window.close();
    }
    let btns = [
      <Button key="Close" style={btnStyle} onClick={() => window.close()} text="Close" />,
      <Button key="Share" style={btnStyle} className="pt-intent-success" onClick={() => saveaction(true)} text="Share" />,
      <Button key="Save" style={btnStyle} className="pt-intent-primary" onClick={() => saveaction(false)} text="Save" />
    ]

    return (<Panel>
      <Row justify="center">
        <h4 className="pt-text-muted" style={{ marginTop: "16px" }}>Bookmark Details</h4>
      </Row>
      <Row>
        <Label span={lspan}>URL:</Label>
        <Col span={rspan}><TextAuto disabled={true} value={this.state.url} /></Col>
      </Row>
      <Row>
        <Label span={lspan}>Title:</Label>
        <Col span={rspan}><TextAuto value={this.state.title} onChange={v => this.changeTitle(v)} /></Col>
      </Row>
      <Row>
        <Label span={lspan}>Comment:</Label>
        <Col span={rspan}><TextAuto value={this.state.comment} onChange={v => this.changeComment(v)} /></Col>
      </Row>
      <Row>
        <Label span={lspan}>Tags:</Label>
        <Col span={rspan}><Tags.TagGroupEditor tags={this.state.tags} creatable={true} allTags={this.props.appState.allTags} onChange={(tags) => this.changeTags(tags)} /></Col>
      </Row>
      <Row justify="end">
        {btns}
      </Row>
    </Panel>);
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
    setTimeout(() => this.setState({ macfix: true }), 100);
  }

  render() {
    let props = this.props;
    let st = props.appState;
    let curl = st.activeUrl

    let launch = () => Chrome.sendMessage({ eventType: "LaunchPage", page: "home" });
    let { btnStyle, rowStyle, gutter, bannerTextColor } = Constants;
    let btns = [
      <Button key="Home" style={btnStyle} className="pt-intent-success" iconName="pt-icon-home" onClick={launch} text="Home" />,
    ]
    if (!curl) btns.unshift(<Button key="Close" style={btnStyle} onClick={() => window.close()} text="Close" />);

    if (st.lastErrorMessage) toast.show({ message: "Error: " + st.lastErrorMessage });
    return <div>
      <Row style={rowStyle} gutter={gutter} justify="space-between" align="center" >
        <Col span={3}><h2 style={{ color: bannerTextColor }}><b><i>eqURLity</i></b></h2></Col>
        <Col span={9}>
          <Row style={rowStyle} gutter={gutter} justify="end">{btns}</Row>
        </Col>
      </Row>
      {curl && <BookmarkPanel appState={this.props.appState} />}
      {this.state.macfix && <p />}
    </div>
  }
}

