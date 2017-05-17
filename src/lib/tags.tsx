import * as React from 'react';
import { Tag } from "@blueprintjs/core";
import { Creatable } from 'react-select';
import { Row } from 'react-simple-flex-grid';

export type TagSelectOption = { value: string, label: string }

export function mergeTags(tags: string[], _allTags: TagSelectOption[]): TagSelectOption[] {
  //  assumes _allTags is sorted
  let allTags = _allTags;
  let fnd = false;
  tags.forEach(c => {
    if (c > allTags[allTags.length - 1].label) {
      if (!fnd) {
        fnd = true;
        allTags = allTags.slice();
      }
      allTags.push({ label: c, value: c });
      return;
    }
    let i = allTags.findIndex(t => c <= t.label);
    if (i > 0) {
      let lbl = allTags[i].label;
      if (c < lbl) {
        if (!fnd) {
          fnd = true;
          allTags = allTags.slice();
        }
        allTags.splice(i, 0, { label: c, value: c });
      }
    }
  })
  return allTags;
}

interface QtagProps { label: string, style?: any, onClick?: (label: string) => void, onRemove?: (label: string) => void }
class Qtag extends React.Component<QtagProps, {}> {
  render() {
    let { label, onClick, onRemove, style } = this.props;
    if (!style) style = { marginLeft: '3px' };  //TODO merge styles stuff
    if (onRemove) return <Tag className="pt-minimal pt-round" style={style} key={'tag:' + label} onRemove={() => onRemove(label)} > {label}</Tag>;
    return <Tag className="pt-minimal pt-round" style={style} key={'tag:' + label} onClick={() => onClick && onClick(label)} > {label}</Tag>;
  }
}

interface TagGroupProps { tags: string[], onClick?: (label: string) => void, onRemove?: (label: string) => void }
export class TagGroup extends React.Component<TagGroupProps, {}> {
  render() {
    if (!this.props.tags) return null;
    let tags = this.props.tags.map(label => <Qtag label={label} onRemove={this.props.onRemove} onClick={this.props.onClick} />);
    return <div>{tags}</div>
  }
};

interface TagGroupEditorProps { tags: string[], allTags: TagSelectOption[], onChange: (vals: string[]) => void }
export class TagGroupEditor extends React.Component<TagGroupEditorProps, {}> {

  removeTag(tag: string) {
    let tags = this.props.tags;
    let i = tags.indexOf(tag);
    if (i >= 0) {
      tags = tags.slice()
      tags.splice(i, 1);
      this.props.onChange(tags)
    }
  }

  addTag(tag: TagSelectOption) {
    let tags = this.props.tags;
    tags.push(tag.label);
    this.props.onChange(tags);
  }

  render() {
    let tags = this.props.tags.map(label => <Qtag label={label} style={{ leftMargin: '3px', height: '26px' }} onRemove={() => this.removeTag(label)} />);
    tags.push(<Creatable key="__new__" style={{ display: 'inline-block', width: '100px', height: '26px', leftMargin: '3px' }} options={this.props.allTags} onChange={(v) => this.addTag(v)} />);
    return <Row>{tags}</Row>;
  }
};
