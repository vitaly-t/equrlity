import * as React from 'react';
import { Url, format } from 'url';
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-autosize-textarea';
import { Button, Intent } from "@blueprintjs/core";

import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import { TagGroupEditor } from '../lib/tags';

import * as Chrome from './chrome';
import { AppState, isWaiting, getBookmark } from "./AppState";

export interface PopupPanelProps { appState?: AppState; serverMessage?: string };
export interface PopupPanelState { url: Dbt.urlString, title: string, comment: string, tags: string[] };

export class PopupPanel extends React.Component<PopupPanelProps, PopupPanelState> {

    constructor(props: PopupPanelProps) {
        super(props);
        let url = props.appState.activeUrl
        let st: PopupPanelState = { url, title: '', comment: '', tags: [] };
        if (url) {
            let cont = getBookmark(props.appState, url);
            if (cont) st = { url, title: cont.title, comment: cont.content, tags: cont.tags };
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
        if (props.serverMessage) {
            console.log("rendering server message...");
            return <div>Server error: {props.serverMessage} </div>;
        }
        let st = props.appState;
        let curl = st.activeUrl

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
            let cont = getBookmark(st, curl);
            let lbl = "Save";
            let saveaction = () => {
                let { title, comment, tags, url } = this.state;
                Chrome.sendMessage({ eventType: "BookmarkLink", url, title, comment, tags });
                window.close();
            }
            let promTxt = null;
            btns.push(<Button key="Save" style={btnStyle} className="pt-intent-primary" onClick={saveaction} text={lbl} />);
            pnl = (<div>
                <Row style={rowStyle} gutter={gutter} align="top">
                    <Col span={lspan}>Source URL : </Col>
                    <Col span={rspan}><TextareaAutosize style={{ width: '100%' }} value={this.state.url} /></Col>
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

