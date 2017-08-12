import * as React from 'react';
import * as ReactDOM from "react-dom";

import { FilterContext, FilteredPanel } from '../lib/filters';
import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Tags from '../lib/tags';

interface PeoplePanelProps { people: Rpc.UserInfoItem[], allTags: Tags.TagSelectOption[], user?: Dbt.User };
interface PeoplePanelState { };

export class PeoplePanel extends React.Component<PeoplePanelProps, PeoplePanelState> {

  constructor(props: PeoplePanelProps) {
    super(props);
    this.state = {};
  }

  render() {
    let { people, allTags, user } = this.props;
    let tagfilter = (f: Rpc.UserInfoItem, filters: string[]): boolean => {
      let { tags } = f;
      if (!tags) tags = [];
      for (let f of filters) if (tags.indexOf(f) < 0) return false;
      return true;
    }
    return <FilteredPanel rows={people} filterFn={tagfilter} allTags={allTags}>
      {(filteredPeople: Rpc.UserInfoItem[], filterContext: FilterContext) => {
        let rows = filteredPeople.map(l => {
          let { userName, tags } = l
          let tagGrp = <Tags.TagGroup tags={tags} onClick={(s) => filterContext.addFilter(s)} />;
          return <tr key={userName} >
            <td><a href={Utils.homePageUrl(userName)} >{userName}</a></td>
            <td>{tagGrp}</td>
          </tr>;
        });
        return (
          <table className="pt-table pt-striped pt-bordered">
            <thead>
              <tr>
                <th>User</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {rows}
            </tbody>
          </table>
        );
      }
      }
    </FilteredPanel>
  }
}

