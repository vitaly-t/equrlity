import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, Checkbox, Popover, PopoverInteractionKind, Position, IToaster } from "@blueprintjs/core";
import { Url, format } from 'url';

import { Row, Col, Label } from '../lib/components';
import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { btnStyle, lhcolStyle } from "../lib/constants";
import * as Tags from '../lib/tags';
import { IReadonlyMap } from '../lib/cacheTypes';

interface FeedsPanelProps { feeds: Rpc.FeedItem[], allTags: Tags.TagSelectOption[] };
interface FeedsPanelState { filters: string[] };

export class FeedsPanel extends React.Component<FeedsPanelProps, FeedsPanelState> {

  constructor(props: FeedsPanelProps) {
    super(props);
    this.state = { filters: [] };
  }

  addFilter(f: string) {
    let filters = this.state.filters;
    if (filters.indexOf(f) < 0) {
      filters = [...filters, f];
      this.setState({ filters });
    }
  }

  removeFilter(f: string) {
    let filters = [...this.state.filters];
    let i = filters.indexOf(f);
    if (i >= 0) filters.splice(i, 1);
    this.setState({ filters });
  }

  render() {
    let linkdiv = <p>There are no current feed items.</p>
    let { feeds, allTags } = this.props;
    let filteredLinks: Rpc.FeedItem[] = []
    if (feeds.length > 0) {
      let tagfilter = (tags: string[], source: string): boolean => {
        if (!tags) tags = [];
        for (let f of this.state.filters) if (tags.indexOf(f) < 0 && f !== source) return false;
        return true;
      }
      filteredLinks = feeds.filter(f => tagfilter(f.tags, f.source));
      let linkrows = filteredLinks.map(l => {
        let { comment, url, source, tags } = l
        let tagGrp = <Tags.TagGroup tags={l.tags} onClick={(s) => this.addFilter(s)} />;

        return (
          <tr key={url} >
            <td>{OxiDate.timeAgo(new Date(l.created))}</td>
            <td><a href={url} >{url}</a></td>
            <td><Tags.TagGroup tags={[source]} onClick={(s) => this.addFilter(s)} /></td>
            <td>{comment}</td>
            <td>{tagGrp}</td>
          </tr>
        );
      });
      linkdiv = (
        <table className="pt-table pt-striped pt-bordered">
          <thead>
            <tr>
              <th>Created</th>
              <th>Share</th>
              <th>Source</th>
              <th>Comment</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {linkrows}
          </tbody>
        </table>
      );
    }

    let vsp = <div style={{ height: "20px" }} />;
    let filters = this.state.filters;
    let fltrs = <Tags.TagGroupEditor creatable={false} tags={filters} allTags={allTags} onChange={filters => this.setState({ filters })} />;
    return (
      <div>
        <Row align="top" ><span>Showing : </span><div style={{ display: 'inline-block' }}>{fltrs}</div></Row>
        {vsp}
        {linkdiv}
      </div>);
  }
}

