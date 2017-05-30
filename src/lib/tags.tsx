import * as React from 'react';
import { Tag } from "@blueprintjs/core";
import * as Select from 'react-select';
import { Row } from 'react-simple-flex-grid';

export type TagSelectOption = { value: string, label: string }

export function mergeTags(tags: string[], _allTags: TagSelectOption[]): TagSelectOption[] {
  //  assumes _allTags is sorted
  let allTags = _allTags;
  let fnd = false;
  tags && tags.forEach(c => {
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

interface QtagProps { label: string, tagClass?: string, style?: any, onClick?: (label: string) => void, onRemove?: (label: string) => void }
class Qtag extends React.Component<QtagProps, {}> {
  render() {
    let { label, onClick, onRemove, style, tagClass } = this.props;
    if (!style) style = { marginLeft: '3px' };  //TODO merge styles stuff
    let lblStyle = onClick || onRemove ? { cursor: "pointer" } : {};
    let lblClss = tagClass ? "pt-text" : "pt-text-muted";
    let lbl = <div className={lblClss} style={lblStyle}>{label}</div>
    let clss = tagClass || "pt-minimal pt-round";
    if (onRemove) return <Tag className={clss} style={style} onClick={() => onRemove(label)} onRemove={() => onRemove(label)} > {lbl}</Tag>;
    return <Tag className={clss} style={style} onClick={() => onClick && onClick(label)} >{lbl}</Tag>;
  }
}

interface TagGroupProps { tags: string[], tagClass?: string, onClick?: (label: string) => void, onRemove?: (label: string) => void }
export class TagGroup extends React.Component<TagGroupProps, {}> {
  render() {
    if (!this.props.tags) return null;
    let tags = this.props.tags.map(label => <Qtag key={'tag:' + label} tagClass={this.props.tagClass} label={label} onRemove={this.props.onRemove} onClick={this.props.onClick} />);
    return <div>{tags}</div>
  }
};

export interface TagGroupEditorProps { tags: string[], tagClass?: string, allTags: TagSelectOption[], creatable: boolean, onChange: (vals: string[]) => void }
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
    let tags = this.props.tags || [];
    if (tags.indexOf(tag.label) < 0) {
      tags = [...tags, tag.label];
      this.props.onChange(tags);
    }
  }

  render() {
    let a = this.props.tags || [];
    let tags = a.map(label => <Qtag key={'tag:' + label} tagClass={this.props.tagClass} label={label} style={{ marginLeft: '3px', height: '26px' }} onRemove={() => this.removeTag(label)} />);
    if (this.props.creatable) tags.push(<Select.Creatable key="__new__" style={{ display: 'inline-block', width: '150px', height: '26px', marginLeft: '3px' }} options={this.props.allTags} onChange={(v) => this.addTag(v)} />);
    else tags.push(<Select key="__sel__" style={{ display: 'inline-block', width: '150px', height: '26px', marginLeft: '3px' }} options={this.props.allTags} onChange={(v) => this.addTag(v)} />);
    return <Row>{tags}</Row>;
  }
};
