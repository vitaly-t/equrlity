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
export const btnStyle= { height: '24', marginTop: 2, marginLeft: 5, marginRight: 5, display: 'inline-block' }; 
export const lhcolStyle = { width: '20%' };


interface PostViewProps { post: Dbt.Post, creator: string };
interface PostViewState { };

let Tag = (props) => {
  return (<button className="pt-intent-primary" style={{ marginLeft: 3, marginRight: 3 }} {...props} >{props.children}</button>);
};

export class PostView extends React.Component<PostViewProps, PostViewState> {

  render() {
    let {post,creator} = this.props;
    let h = { __html: md.render(post.body) };
    let lstedit = post.updated ? oxiDate.toFormat(new Date(post.updated), "DDDD, MMMM D @ HH:MIP") : 'never';
    let pub = post.published ? oxiDate.toFormat(new Date(post.published), "DDDD, MMMM D @ HH:MIP") : 'never';
    let tags = post.tags
    let tagbtns = tags.map(t => <Tag key={'tag:' + t} >{t}</Tag>);
    return (
      <div>
        <h2>{post.title}</h2>
        <div style={rowStyle} dangerouslySetInnerHTML={h} />
        <div style={rowStyle} >
          <div style={{ display: 'inline' }}>Tags: </div>
          {tagbtns}
        </div>
        <div style={rowStyle} >Created by: {creator}.</div>
        <div style={rowStyle} >Published: {pub}.</div>
        <div style={rowStyle} >Last Edited: {lstedit}.</div>
      </div>
    );
  }
}


