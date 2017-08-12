import * as React from 'react';

import * as Tags from '../lib/tags';
import { Row } from '../lib/components';


export type FilterContext = {
  filters: () => string[];
  setFilters: (a: string[]) => void;
  addFilter: (t: string) => void;
}

interface FilteredPanelProps {
  rows: any[],
  filterFn: (r: any, filters: string[]) => boolean,
  allTags: Tags.TagSelectOption[],
  children: (rows: any[], filterContext: FilterContext) => React.ReactNode
};

interface FilteredPanelState { filters: string[] };
export class FilteredPanel extends React.Component<FilteredPanelProps, FilteredPanelState> implements FilterContext {

  constructor(props: FilteredPanelProps) {
    super(props);
    this.state = { filters: [] };
  }

  filters() {
    return this.state.filters;
  }

  setFilters(filters) {
    this.setState({ filters });
  }

  addFilter(f: string) {
    let filters = this.state.filters;
    if (filters.indexOf(f) < 0) {
      filters = [...filters, f];
      this.setState({ filters });
    }
  }

  render() {
    let { rows, filterFn, allTags, children } = this.props;
    if (rows.length === 0) {
      return (<div>
        {children(rows, this as FilterContext)}
      </div>);

    }
    let filters = this.state.filters;
    let filteredRows: any[] = rows.filter(r => filterFn(r, filters));
    let vsp = <div style={{ height: "20px" }} />;
    let fltrs = <Tags.TagGroupEditor creatable={false} tags={filters} allTags={allTags} onChange={filters => this.setFilters(filters)} />;
    return <div>
      <Row align="middle" ><span>Showing : </span><div style={{ display: 'inline-block' }}>{fltrs}</div></Row>
      {vsp}
      {children(filteredRows, this as FilterContext)}
    </div>;
  }
}

