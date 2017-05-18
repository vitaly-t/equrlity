"use strict";

import * as oxiDate from '../lib/oxidate';
import * as utils from '../lib/utils';
import * as uuid from '../lib/uuid.js';

import { TimeSpan } from '../lib/timeSpan';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import * as Utils from '../lib/utils';

import { TagGroup } from './tags';

import * as Remarkable from 'remarkable';
const md = new Remarkable({ html: true });

import * as Blueprint from "@blueprintjs/core";
//import '@blueprintjs/core/dist/blueprint.css';

export const rowStyle = { width: '100%', marginTop: 2, marginLeft: 5, padding: 6 };
export const btnStyle = { height: '24', marginTop: 2, marginLeft: 5, marginRight: 5, display: 'inline-block' };
export const lhcolStyle = { width: '20%' };

interface ContentViewProps { info: Dbt.Content, owner: string };
interface ContentViewState { };

export class ContentView extends React.Component<ContentViewProps, ContentViewState> {

  render() {
    let { info, owner } = this.props;
    let h = { __html: md.render(info.content) };
    let lstedit = info.updated ? oxiDate.toFormat(new Date(info.updated), "DDDD, MMMM D @ HH:MIP") : 'never';
    let tags = info.tags
    let hpg = Utils.homePageUrl(owner);
    let tagbtns = <TagGroup tags={tags} />;
    let hdr = (info.contentType === "post") ? null : <h3>{info.title}</h3>;
    return (
      <div>
        {hdr}
        <div style={rowStyle} dangerouslySetInnerHTML={h} />
        <div style={rowStyle} >
          <div style={{ display: 'inline' }}>Tags: </div>
          {tagbtns}
        </div>
        <div style={rowStyle} >Uploaded by: <a href={hpg} target="_blank">{owner}</a>.</div>
        <div style={rowStyle} >Last Modified: {lstedit}.</div>
      </div>
    );
  }
}



