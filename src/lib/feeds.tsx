import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button, Dialog, Intent, Checkbox, Popover, PopoverInteractionKind, Position, IToaster } from "@blueprintjs/core";
import { Url, format } from 'url';

import { Row, Col, Label } from '../lib/components';
import { FilterContext, FilteredPanel } from '../lib/filters';
import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import * as OxiDate from '../lib/oxidate';
import { btnStyle, lhcolStyle } from "../lib/constants";
import * as Tags from '../lib/tags';

interface FeedsPanelProps { feeds: Rpc.FeedItem[], allTags: Tags.TagSelectOption[] };
interface FeedsPanelState { };

export class FeedsPanel extends React.Component<FeedsPanelProps, FeedsPanelState> {

  constructor(props: FeedsPanelProps) {
    super(props);
    this.state = {};
  }

  render() {
    let { feeds, allTags } = this.props;
    let filteredLinks: Rpc.FeedItem[] = []
    if (feeds.length === 0) return <p>There are no current feed items.</p>;
    let tagfilter = (f: Rpc.FeedItem, filters: string[]): boolean => {
      let { tags, source, type } = f;
      if (!tags) tags = [];
      for (let f of filters) if (tags.indexOf(f) < 0 && f !== source && f !== type) return false;
      return true;
    }
    return <FilteredPanel rows={feeds} filterFn={tagfilter} allTags={allTags}>
      {(filteredLinks: Rpc.FeedItem[], filterContext: FilterContext) => {
        let linkrows = filteredLinks.map(l => {
          let { comment, url, source, tags } = l
          let tagGrp = <Tags.TagGroup tags={l.tags} onClick={(s) => filterContext.addFilter(s)} />;

          return <tr key={url} >
            <td>{OxiDate.timeAgo(new Date(l.created))}</td>
            <td><a href={url} target="_blank" >{url}</a></td>
            <td><Tags.TagGroup tags={[l.type]} onClick={(s) => filterContext.addFilter(s)} /></td>
            {false && <td><Tags.TagGroup tags={[source]} onClick={(s) => filterContext.addFilter(s)} /></td>}
            <td>{comment}</td>
            <td>{tagGrp}</td>
          </tr>;
        });
        return (
          <table className="pt-table pt-striped pt-bordered">
            <thead>
              <tr>
                <th>Created</th>
                <th>URL</th>
                <th>Type</th>
                {false && <th>Source</th>}
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
      }
    </FilteredPanel>
  }
}
