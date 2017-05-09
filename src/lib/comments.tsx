import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, ITreeNode, Intent, Checkbox, Position, Toaster, Collapse } from "@blueprintjs/core";
import { Url, format } from 'url';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import * as OxiGen from '../gen/oxigen';
import { rowStyle, btnStyle, lhcolStyle } from "../lib/ContentView";
import * as Tags from '../lib/tags';
import * as Comms from '../lib/axiosClient';

import { MarkdownEditor } from '../lib/markdownEditor';

const gutter = 20;

const toast = Toaster.create({
  className: "comments-toaster",
  position: Position.TOP,
});

type CommentNode = { item: Rpc.CommentItem; responses: CommentNode[]; collapsed: boolean };

interface CommentEditorProps { onReply: (s: string) => void, title?: string, onAbandon?: () => void };
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
    let ttl = this.props.title || '';
    let onAbandon = this.props.onAbandon ? () => this.props.onAbandon() : null;
    return <MarkdownEditor value='' title={ttl} onSave={s => this.onSave(s)} onAbandon={onAbandon} />
  }
}

interface CommentItemProps { node: CommentNode, depth: number, privKey: JsonWebKey, onReply: (s: string, parent: CommentNode) => void };
interface CommentItemState { collapsed: boolean, replying: boolean };
export class CommentItem extends React.Component<CommentItemProps, CommentItemState> {
  constructor(props) {
    super(props);
    this.state = { collapsed: this.props.node.collapsed, replying: false };
  }

  toggleCollapsed() {
    let collapsed = !this.state.collapsed;
    this.setState({ collapsed });
    //let collapsed = !this.props.node.collapsed;
    this.props.node.collapsed = collapsed;
    //this.forceUpdate();
  }

  onReply = async (comment: string) => {
    this.props.onReply(comment, this.props.node);
    this.setState({ replying: false });
  }

  render() {
    let { depth, onReply, node, privKey } = this.props;
    let { item, responses } = node;
    let rsps = responses.map(nd => <CommentItem key={nd.item.commentId} node={nd} depth={depth + 1} privKey={privKey} onReply={onReply} />);
    let reply = this.state.replying
      ? <CommentEditor title="Add Reply:" onReply={s => this.onReply(s)} onAbandon={() => this.setState({ replying: false })} />
      : (this.props.privKey &&
        <Button className="pt-minimal" iconName="comment" onClick={() => this.setState({ replying: true })} ><span className="pt-text-muted">Reply</span></Button>)
      ;
    let gutter = 0;
    //let w = (100 - (depth * 3)).toString() + "%";
    let w = "97%";
    return <div>
      <Row gutter={gutter} justify="end">
        <Col style={{ width: w }} >
          <span className="pt-text-muted" >{item.userName}, {OxiDate.timeAgo(new Date(item.created))}</span>
          <span><Button className="pt-minimal" onClick={() => this.toggleCollapsed()}
            iconName={this.state.collapsed ? "caret-right" : "caret-down"}>
            <span className="pt-text-muted">{this.state.collapsed ? `[${responses.length} replies]` : ''}</span></Button>
          </span>
        </Col>
      </Row>
      <Collapse isOpen={!this.state.collapsed}>
        <Row gutter={gutter} justify="end">
          <Col style={{ width: w }} >
            <p className="pt-ui-text-large">{item.comment}</p>
            {reply}
          </Col>
        </Row>
        <Row gutter={gutter} justify="end">
          <Col style={{ width: w }} >
            {rsps}
          </Col>
        </Row>
      </Collapse>
    </div >
  }
}

function buildTree(comments: Rpc.CommentItem[]): CommentNode[] {

  comments.sort((a, b) => Utils.cmp<Rpc.CommentItem, number>(a, b, e => e.commentId));
  let nodes: CommentNode[] = comments.map(item => {
    let node: CommentNode = { item, responses: [], collapsed: false };
    return node;
  });
  let [y, n] = Utils.partition<CommentNode>(nodes, e => e.item.parent === 0);
  n.forEach(c => {
    let i = nodes.findIndex(e => e.item.commentId === c.item.parent);
    if (i === -1) y.push(c); // throw new Error("orphaned comment found");
    else nodes[i].responses.push(c);
  })
  return y;
}

interface CommentsPanelProps { contentId: Dbt.contentId, comments: Rpc.CommentItem[], privKey: JsonWebKey };
interface CommentsPanelState { nodes: CommentNode[]; };
export class CommentsPanel extends React.Component<CommentsPanelProps, CommentsPanelState> {

  constructor(props: CommentsPanelProps) {
    super(props);
    let nodes = buildTree(props.comments);
    this.state = { nodes };
  }

  componentWillReceiveProps(props: CommentsPanelProps) {
    let nodes = buildTree(props.comments);
    this.setState({ nodes });
  }

  addResponse = async (comment, node: CommentNode) => {
    let contentId = this.props.contentId
    let parent = node ? node.item.commentId : 0;
    let signature = await Comms.signData(this.props.privKey, comment);
    let req: Rpc.AddCommentRequest = { contentId, comment, parent, signature };
    let _rsp = await Comms.sendApiRequest("addComment", req);
    let rsp: Rpc.AddCommentResponse = Comms.extractResult(_rsp);
    let newnd = { item: rsp.comment, responses: [], collapsed: false }
    let nodes;
    if (node) {
      node.responses.push(newnd);
      nodes = [...this.state.nodes]
    }
    else nodes = [...this.state.nodes, newnd];
    this.setState({ nodes });
  }

  render() {
    let itms = this.state.nodes.map(nd => <CommentItem key={nd.item.commentId} node={nd} depth={0} privKey={this.props.privKey} onReply={(s, node) => this.addResponse(s, node)} />)
    return <div>
      {this.props.privKey && <CommentEditor title="Add Comment:" onReply={s => this.addResponse(s, null)} />}
      {itms}
    </div>;
  }
}

