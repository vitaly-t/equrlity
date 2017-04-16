import * as React from 'react';
import { Tag } from "@blueprintjs/core";

interface TagGroupProps { tags: string[] }
export class TagGroup extends React.Component<TagGroupProps, {}> {
  render() {
    let tags = this.props.tags.map(label => <Tag className="pt-minimal pt-round" key={'tag:' + label} > {label}</Tag>);
    return <div>{tags}</div>
  }
};

interface TagGroupEditorProps { tags: string[], removeTag: (tag: string) => void }
export class TagGroupEditor extends React.Component<TagGroupEditorProps, {}> {
  render() {
    let tags = this.props.tags.map(label => <Tag className="pt-minimal pt-round" key={'tag:' + label} onRemove={() => this.props.removeTag(label)} > {label}</Tag>);
    return <span>{tags}</span>
  }
};
