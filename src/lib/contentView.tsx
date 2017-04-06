"use strict";

import * as oxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';

import { TimeSpan } from '../lib/timeSpan';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';

import * as Remarkable from 'remarkable';
const md = new Remarkable({ html: true });

import * as Blueprint from "@blueprintjs/core";
//import '@blueprintjs/core/dist/blueprint.css';

export const rowStyle = { width: '100%', marginTop: 2, marginLeft: 5, padding: 6 };
export const btnStyle = { height: '24', marginTop: 2, marginLeft: 5, marginRight: 5, display: 'inline-block' };
export const lhcolStyle = { width: '20%' };

interface ContentViewProps { info: Rpc.ContentInfoItem, creator: string };
interface ContentViewState { };

let Tag = (props) => {
  return (<button className="pt-intent-primary" style={{ marginLeft: 3, marginRight: 3 }} {...props} >{props.children}</button>);
};

export class ContentView extends React.Component<ContentViewProps, ContentViewState> {

  render() {
    let { info, creator } = this.props;
    let h = { __html: md.render(info.content) };
    let lstedit = info.updated ? oxiDate.toFormat(new Date(info.updated), "DDDD, MMMM D @ HH:MIP") : 'never';
    let pub = info.published ? oxiDate.toFormat(new Date(info.published), "DDDD, MMMM D @ HH:MIP") : 'never';
    let tags = info.tags
    let tagbtns = tags.map(t => <Tag key={'tag:' + t} >{t}</Tag>);
    return (
      <div>
        <h2>{info.title}</h2>
        <div style={rowStyle} dangerouslySetInnerHTML={h} />
        <div style={rowStyle} >
          <div style={{ display: 'inline' }}>Tags: </div>
          {tagbtns}
        </div>
        <div style={rowStyle} >Created by: {creator}.</div>
        <div style={rowStyle} >Last Edited: {lstedit}.</div>
      </div>
    );
  }
}



