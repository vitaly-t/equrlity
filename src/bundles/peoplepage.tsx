import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Remarkable from 'remarkable';

import * as Rpc from "../lib/rpc";
import * as Tags from "../lib/tags";
import { LandingPage } from '../lib/landingPages';
import { PeoplePanel } from "../lib/people";

export interface PeoplePageProps { isClient: boolean, people: Rpc.UserActivityInfo[], allTags: Tags.TagSelectOption[] }
export const PeoplePage: React.StatelessComponent<PeoplePageProps> = props => {
  let { isClient, people, allTags } = props;
  return (
    <LandingPage subtitle={"qURLers United"} >
      <PeoplePanel people={people} allTags={allTags} />
    </LandingPage>
  );
};

function render() {
  let elem = document.getElementById('app')
  if (!elem) throw new Error("cannot get app element");
  let strProps = elem.dataset.props;
  let props = JSON.parse(strProps)
  let { isClient, people, allTags } = props;
  ReactDOM.render(<PeoplePage isClient={isClient} people={people} allTags={Tags.mergeTags(allTags)} />, elem);
}

document.addEventListener('DOMContentLoaded', () => {
  render();
});