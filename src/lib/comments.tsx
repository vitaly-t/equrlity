import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, ITreeNode, Intent, Checkbox, Position, Toaster, Collapse } from "@blueprintjs/core";
import { Url, format } from 'url';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import * as OxiGen from '../gen/oxigen';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/ContentView";
import * as Tags from '../lib/tags';

import { MarkdownEditor } from '../lib/markdownEditor';

const gutter = 20;

const toast = Toaster.create({
  className: "comments-toaster",
  position: Position.TOP,
});

type CommentNode = { item: Rpc.CommentItem; responses: CommentNode[] };

interface CommentEditorProps { onReply: (s: string) => void };
interface CommentEditorState { };
export class CommentEditor extends React.Component<CommentEditorProps, CommentEditorState> {
  constructor(props) {
    super(props);
    this.state = {};
  }

  onSave(s: string) {
    this.props.onReply(s);
  }

  render() {
    return <MarkdownEditor value='' onSave={s => this.onSave(s)} />
  }
}

interface CommentItemProps { node: CommentNode, depth: number };
interface CommentItemState { collapsed: boolean, replying: boolean };
export class CommentItem extends React.Component<CommentItemProps, CommentItemState> {
  constructor(props) {
    super(props);
    let nodes = buildTree(props.comments);
    this.state = { collapsed: false, replying: false };
  }

  toggleCollapsed() {
    let collapsed = !this.state.collapsed;
    this.setState({ collapsed });
  }

  onReply(s: string) {
    // do something with s
    this.setState({ replying: false });
  }

  render() {
    let { item, responses } = this.props.node;
    let rsps = responses.map(nd => <CommentItem key={nd.item.commentId} node={nd} depth={this.props.depth + 1} />);
    let reply = this.state.replying
      ? <CommentEditor onReply={s => this.onReply(s)} />
      : <Button className="pt-minimal" iconName="comment" onClick={() => this.setState({ replying: true })} text="Reply" />
      ;
    return <div>
      <Row>
        <Col offset={this.props.depth}>
          <span>{item.userName}, {OxiDate.timeAgo(item.created)}</span>
          <span><Button className="pt-minimal" iconName={this.state.collapsed ? "caret-right" : "caret-down"} onClick={() => this.toggleCollapsed()} text="" /></span>
        </Col>
      </Row>
      <Collapse isOpen={!this.state.collapsed}>
        <Row>
          <Col offset={this.props.depth}>
            <p>{item.comment}</p>
            {reply}
          </Col>
        </Row>
        <Row>{rsps}</Row>
      </Collapse>
    </div >
  }
}

function buildTree(comments: Rpc.CommentItem[]): CommentNode[] {

  comments.sort((a, b) => Utils.cmp<Rpc.CommentItem, number>(a, b, e => e.commentId));
  let nodes: CommentNode[] = comments.map(item => {
    let node: CommentNode = { item, responses: [] };
    return node;
  });
  let [y, n] = Utils.partition<CommentNode>(nodes, e => e.item.parent === 0);
  n.forEach(c => {
    let i = nodes.findIndex(e => e.item.commentId === c.item.parent);
    if (i === -1) throw new Error("orpaned comment found");
    nodes[i].responses.push(c);
  })
  return y;
}

interface CommentsPanelProps { comments: Rpc.CommentItem[] };
interface CommentsPanelState { nodes: CommentNode[]; };
export class CommentsPanel extends React.Component<CommentsPanelProps, CommentsPanelState> {

  constructor(props) {
    super(props);
    let nodes = buildTree(props.comments);
    this.state = { nodes };
  }

  addResponse(s) {

  }

  render() {
    let itms = this.state.nodes.map(nd => <CommentItem key={nd.item.commentId} node={nd} depth={0} />)
    return <div>
      <CommentEditor onReply={s => this.addResponse(s)} />
      {itms}
    </div>;
  }
}

