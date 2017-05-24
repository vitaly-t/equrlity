
import * as React from 'react';
import * as ReactDOM from "react-dom";

import { Button, Dialog } from "@blueprintjs/core";
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-autosize-textarea';

import * as Remarkable from 'remarkable';

interface MarkdownPreviewProps { text: string, allowHtml: boolean, newTab?: boolean, onClose: () => void };
interface MarkdownPreviewState { isOpen: boolean, md: any };
export class MarkdownPreview extends React.Component<MarkdownPreviewProps, MarkdownPreviewState> {

  constructor(props: MarkdownPreviewProps) {
    super(props);
    let html = props.allowHtml || false;
    let md = new Remarkable({ html });
    this.state = { isOpen: true, md };
  }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  render() {
    let h = { __html: this.state.md.render(this.props.text) };
    const rowStyle = { width: '100%', marginTop: 2, marginLeft: 5, padding: 6 };

    return (
      <Dialog iconName="inbox" style={{ width: '95%' }} isOpen={this.state.isOpen} title={"Preview rendered Markdown"} canOutsideClickClose={true} onClose={() => this.close()} >
        <div style={rowStyle} dangerouslySetInnerHTML={h} />
      </Dialog >
    );
  }
}

interface MarkdownEditorProps { value: string, title?: string, isDirty?: boolean, enableAbandon?: boolean, allowHtml: boolean, onSave?: () => void, onChange: (s: string) => void, onAbandon?: () => void, onPreview?: (s: string) => void }
interface MarkdownEditorState { previewing: boolean };
export class MarkdownEditor extends React.Component<MarkdownEditorProps, MarkdownEditorState> {

  constructor(props: MarkdownEditorProps) {
    super(props);
    this.state = { previewing: false };
  }

  preview() {
    if (this.props.onPreview) this.props.onPreview(this.props.value);
    else this.setState({ previewing: true })
  }

  render() {
    if (this.state.previewing) {
      return <MarkdownPreview text={this.props.value} onClose={() => this.setState({ previewing: false })} allowHtml={this.props.allowHtml} />
    }
    let gutter = 10;
    let btnStyle = { marginLeft: gutter / 2 };
    let rowStyle = { margin: gutter / 2 };

    let isDirty = this.props.isDirty;
    let btns = [];
    if (this.props.onAbandon) {
      btns.push(<Button key="Abandon" style={btnStyle} disabled={!isDirty && !this.props.enableAbandon} onClick={() => this.props.onAbandon()} text="Abandon" />);
    }
    btns.push(<Button key="Preview" style={btnStyle} disabled={this.props.value.length === 0} className="pt-intent-success" onClick={() => this.preview()} text="Preview" />);
    if (this.props.onSave) {
      btns.push(<Button key="Save" style={btnStyle} disabled={!isDirty} className="pt-intent-primary" onClick={() => this.props.onSave()} text="Save" />);
    };
    let ttl = null;
    if (this.props.title) ttl = <Row gutter={gutter} align='bottom' style={rowStyle}><h5 style={{ marginTop: "10px" }}>{this.props.title}</h5></Row>;

    return <div className="pt-elevation-0" style={{ width: "100%", height: "100%", backgroundColor: "#F5F8FA" }}>
      {ttl}
      <Row gutter={gutter} style={rowStyle} >
        <TextareaAutosize className="pt-elevation-2" style={{ margin: "5px", width: "100%", minHeight: "100px", maxHeight: "600px", backgroundColor: "white" }}
          value={this.props.value} onChange={e => this.props.onChange(e.target.value)} />
      </Row>
      <Row gutter={gutter} style={rowStyle}  >
        <Col span={3}>
          <a href="https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet" target="_blank">markdown cheatsheet</a>
        </Col>
        <Col span={9}>
          <Row justify="end">{btns}</Row>
        </Col>
      </Row>
    </div>

  }
}
