import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Remarkable from 'remarkable';

import { Row, Col, NavBar } from '../lib/components';
import * as Constants from "../lib/constants";
import { ContentView } from "../lib/contentView";
import * as Dbt from "../lib/datatypes";
import * as Rpc from "../lib/rpc";
import * as Utils from "../lib/utils";
import * as Tags from "../lib/tags";
import { IReadonlyMap } from '../lib/cacheTypes';
import { LandingPage } from '../lib/landingPages';

import { FeedsPanel } from "../lib/feeds";

export interface HomePageProps { isClient: boolean, feeds: Rpc.FeedItem[], allTags: Tags.TagSelectOption[] }
export const HomePage: React.StatelessComponent<HomePageProps> = props => {
  let { isClient, feeds, allTags } = props;
  return (
    <LandingPage subtitle={isClient ? "Feed Central" : "Public Feed"} >
      <FeedsPanel feeds={feeds} allTags={allTags} />
    </LandingPage>
  );
};

function render() {
  let elem = document.getElementById('app')
  if (!elem) throw new Error("cannot get app element");
  let strProps = elem.dataset.props;
  let props = JSON.parse(strProps)
  let { isClient, feeds, allTags } = props;
  ReactDOM.render(<HomePage isClient={isClient} feeds={feeds} allTags={Tags.mergeTags(allTags)} />, elem);
}

document.addEventListener('DOMContentLoaded', () => {
  render();
});