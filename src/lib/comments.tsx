import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, ITreeNode, Intent, Checkbox, Position, Toaster, Collapse } from "@blueprintjs/core";
import { Url, format } from 'url';
import { Row, Col } from 'react-simple-flex-grid';
import * as Remarkable from 'remarkable';

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

const md = new Remarkable({ html: false });


const gutter = 20;

const toast = Toaster.create({
  className: "comments-toaster",
  position: Position.TOP,
});

type CommentNode = { item: Rpc.CommentItem; responses: CommentNode[]; collapsed: boolean };

interface CommentEditorProps { value: string, isDirty: boolean, title?: string, onSave?: () => void, onChange: (s: string) => void, enableAbandon?: boolean, onAbandon?: () => void };
interface CommentEditorState { };
export class CommentEditor extends React.Component<CommentEditorProps, CommentEditorState> {

  render() {
    let ttl = this.props.title || '';
    let onAbandon = this.props.onAbandon ? () => this.props.onAbandon() : null;
    let onSave = this.props.onSave ? () => this.props.onSave() : null;
    return <MarkdownEditor value={this.props.value} title={ttl} isDirty={this.props.isDirty} enableAbandon={this.props.enableAbandon}
      onSave={onSave} onChange={s => this.props.onChange(s)} onAbandon={onAbandon} allowHtml={false} />
  }
}

interface CommentItemProps {
  node: CommentNode, depth: number, canCensor: boolean, userName: Dbt.userName, isLast?: boolean
  onReply: (s: string, parent: CommentNode) => void, onEdit: (s: string, node: CommentNode) => void
};
interface CommentItemState { collapsed: boolean, replying: boolean, editing: boolean, value: string };
export class CommentItem extends React.Component<CommentItemProps, CommentItemState> {
  constructor(props) {
    super(props);
    this.state = { collapsed: this.props.node.collapsed, replying: false, editing: false, value: "" };
  }

  toggleCollapsed() {
    let collapsed = !this.state.collapsed;
    this.setState({ collapsed });
    this.props.node.collapsed = collapsed;
  }

  onChange(value: string) {
    this.setState({ value });
  }

  onReply() {
    this.props.onReply(this.state.value, this.props.node);
    this.setState({ replying: false });
  }

  onEdit() {
    this.props.onEdit(this.state.value, this.props.node);
    this.setState({ editing: false });
  }

  render() {
    let { depth, onReply, onEdit, node, canCensor, userName } = this.props;
    let { item, responses } = node;
    let { value, replying, editing } = this.state;
    let rsps = responses.map(nd => <CommentItem key={nd.item.commentId} node={nd} depth={depth + 1} onReply={onReply} onEdit={onEdit} canCensor={canCensor} userName={userName} />);
    let reply;
    if (replying) {
      reply = <CommentEditor value={value} title="Add Reply:" isDirty={value.length > 0} enableAbandon={true}
        onSave={() => this.onReply()} onChange={s => this.onChange(s)} onAbandon={() => this.setState({ replying: false })} />;
    }
    else if (editing) {
      reply = <CommentEditor value={value} title="Edit Comment:" isDirty={item.comment !== value} enableAbandon={true}
        onSave={() => this.onEdit()} onChange={s => this.onChange(s)} onAbandon={() => this.setState({ editing: false })} />;
    }
    else if (userName) {
      let btns = [];
      let btnStyle = { marginLeft: 5 };
      btns.push(<Button key="Reply" style={btnStyle} className="pt-minimal" iconName="comment" onClick={() => this.setState({ replying: true, value: '' })} ><span className="pt-text-muted">Reply</span></Button>);
      if (this.props.canCensor) {
        btns.push(<Button key="Censor" style={btnStyle} className="pt-minimal" iconName="pt-icon-ban-circle" onClick={() => this.setState({ editing: true, value: '"NB: this comment has been removed by the moderator."' })} ><span className="pt-text-muted">Censor</span></Button>);
      }
      else if (item.userName === userName && responses.length === 0) {
        btns.push(<Button key="Edit" style={btnStyle} className="pt-minimal" iconName="pt-icon-edit" onClick={() => this.setState({ editing: true, value: item.comment })} ><span className="pt-text-muted">Edit</span></Button>);
      }
      reply = <Row>{btns}</Row>
    }

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
            {!this.state.editing && <div className="pt-ui-text-large" dangerouslySetInnerHTML={{ __html: md.render(item.comment) }} />}
            {reply}
          </Col>
        </Row>
        <Row gutter={gutter} justify="end">
          <Col style={{ width: w }} >
            {rsps}
          </Col>
        </Row>
      </Collapse>
      <Row gutter={gutter} justify="end">
        {!this.props.isLast && <hr style={{ width: w }} />}
      </Row>
    </div >
  }
}

function buildTree(comments: Rpc.CommentItem[]): CommentNode[] {

  comments.sort((a, b) => Utils.cmp<Rpc.CommentItem, number>(a, b, e => e.commentId));
  let nodes: CommentNode[] = comments.map(item => {
    let node: CommentNode = { item, responses: [], collapsed: false };
    return node;
  });
  let [n, y] = Utils.partition<CommentNode>(nodes, e => e.item.parent ? true : false);
  n.forEach(c => {
    let i = nodes.findIndex(e => e.item.commentId === c.item.parent);
    if (i >= 0) nodes[i].responses.push(c);
    //else y.push(c); // throw new Error("orphaned comment found");
  })
  return y;
}

interface CommentsPanelProps { contentId: Dbt.contentId, comments: Rpc.CommentItem[], privKey: JsonWebKey, canCensor: boolean, userName: Dbt.userName };
interface CommentsPanelState { nodes: CommentNode[]; newComment: string };
export class CommentsPanel extends React.Component<CommentsPanelProps, CommentsPanelState> {

  constructor(props: CommentsPanelProps) {
    super(props);
    let nodes = buildTree(props.comments);
    this.state = { nodes, newComment: "" };
  }

  componentWillReceiveProps(props: CommentsPanelProps) {
    let nodes = buildTree(props.comments);
    this.setState({ nodes });
  }

  addResponse = async (comment, node: CommentNode) => {
    let contentId = this.props.contentId
    let parent = node ? node.item.commentId : 0;
    let signature = await Comms.signData(this.props.privKey, comment);
    let req: Rpc.AditCommentRequest = { contentId, comment, parent, signature };
    let _rsp = await Comms.sendApiRequest("aditComment", req);
    let rsp: Rpc.AditCommentResponse = Comms.extractResult(_rsp);
    let newnd = { item: rsp.comment, responses: [], collapsed: false }
    let nodes = [...this.state.nodes];
    let newComment = this.state.newComment;
    if (node) node.responses.push(newnd);
    else {
      nodes.push(newnd);
      newComment = '';
    }
    this.setState({ nodes, newComment });
  }

  editComment = async (comment, node: CommentNode) => {
    let { commentId, contentId, parent } = node.item;
    let signature = await Comms.signData(this.props.privKey, comment);
    let req: Rpc.AditCommentRequest = { contentId, comment, parent, signature };
    let _rsp = await Comms.sendApiRequest("aditComment", req);
    let rsp: Rpc.AditCommentResponse = Comms.extractResult(_rsp);
    node.item = rsp.comment;
    let nodes = [...this.state.nodes];
    this.setState({ nodes, newComment: '' });
  }

  render() {
    let { privKey, canCensor, userName } = this.props;
    let isDirty = this.state.newComment.length > 0
    let itms = this.state.nodes.map(nd => <CommentItem key={nd.item.commentId} node={nd} depth={0} canCensor={canCensor} userName={userName}
      onReply={(s, node) => this.addResponse(s, node)} onEdit={(s, node) => this.editComment(s, node)} />)
    return <div>
      {this.props.privKey && <CommentEditor value={this.state.newComment} isDirty={isDirty} title="Add Comment:"
        onSave={() => this.addResponse(this.state.newComment, null)} onChange={(newComment) => this.setState({ newComment })} onAbandon={() => this.setState({ newComment: '' })} />}
      {itms}
    </div>;
  }
}

