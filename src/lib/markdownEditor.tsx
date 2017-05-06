"use strict";

import * as React from 'react';
import { Button, Dialog } from "@blueprintjs/core";
import { Row, Col } from 'react-simple-flex-grid';
import TextareaAutosize from 'react-autosize-textarea';

import * as Remarkable from 'remarkable';
const md = new Remarkable({ html: true });

interface MarkdownPreviewProps { text: string, onClose: () => void };
interface MarkdownPreviewState { isOpen: boolean };
export class MarkdownPreview extends React.Component<MarkdownPreviewProps, MarkdownPreviewState> {

  constructor(props) {
    super(props);
    this.state = { isOpen: true };
  }

  close() {
    this.props.onClose();
    this.setState({ isOpen: false });
  }

  render() {
    let h = { __html: md.render(this.props.text) };
    const rowStyle = { width: '100%', marginTop: 2, marginLeft: 5, padding: 6 };

    return (
      <Dialog iconName="inbox" style={{ width: '90%', height: '90%' }} isOpen={this.state.isOpen} title={"Preview rendered Markdown"} canOutsideClickClose={true} onClose={() => this.close()} >
        <div style={rowStyle} dangerouslySetInnerHTML={h} />
      </Dialog >
    );
  }
}

interface MarkdownEditorProps { value: string, onSave?: (s: string) => void, onChange?: (s: string) => void }
interface MarkdownEditorState { value: string, previewing: boolean };
export class MarkdownEditor extends React.Component<MarkdownEditorProps, MarkdownEditorState> {

  constructor(props: MarkdownEditorProps) {
    super(props);
    this.state = { value: props.value, previewing: false };
  }

  ctrls: {
    body: HTMLTextAreaElement,
  } = { body: null };

  save() {
    this.props.onSave && this.props.onSave(this.state.value);
  }

  onChange(e) {
    let value = e.target.value;
    this.setState({ value });
    this.props.onChange && this.props.onChange(value);
  }

  abandon() {
    this.setState({ value: this.props.value });
  }

  render() {
    if (this.state.previewing) {
      return <MarkdownPreview text={this.state.value} onClose={() => this.setState({ previewing: false })} />
    }
    let gutter = 10;
    let btnStyle = { marginLeft: gutter / 2 };
    let rowStyle = { margin: gutter / 2 };

    let disabled = this.props.value === this.state.value;
    let btns = [];
    if (this.props.onSave) btns.push(<Button key="Abandon" style={btnStyle} disabled={disabled} onClick={() => this.abandon()} text="Abandon" />);
    btns.push(<Button key="Preview" style={btnStyle} className="pt-intent-success" onClick={() => this.setState({ previewing: true })} text="Preview" />);
    if (this.props.onSave) {
      btns.push(<Button key="Save" style={btnStyle} disabled={disabled} className="pt-intent-primary" onClick={() => this.save()} text="Save" />);
    };

    return <div className="pt-elevation-0" style={{ width: "100%", height: "100%", backgroundColor: "#F5F8FA" }}>
      <Row gutter={gutter} style={rowStyle} >
        <TextareaAutosize className="pt-elevation-2" style={{ margin: "5px", width: "100%", minHeight: "100px", maxHeight: "600px", backgroundColor: "white" }}
          value={this.state.value} onChange={e => this.onChange(e)} />
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
