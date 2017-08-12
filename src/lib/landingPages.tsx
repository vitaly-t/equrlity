import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Remarkable from 'remarkable';
import { Button, Intent } from '@blueprintjs/core';


import { Row, Col, NavBar } from '../lib/components';
import * as Constants from "../lib/constants";
import { ContentView } from "../lib/contentView";
import * as Dbt from "../lib/datatypes";
import * as Utils from "../lib/utils";
import * as Tags from "../lib/tags";
import { IReadonlyMap } from '../lib/cacheTypes';

import { FeedsPanel } from "./feeds";

const md = new Remarkable({ html: true });

const extension_md: string = `
This is an experimental implementation of what we have chosen to call an __Intention Economy__.

We chose this term to distinguish ourselves from the idea of an "Attention Economy" - an epithet we have come to view quite negatively. 
Yet the phrase "Anti-Attention Economy" sounds too negative, and simply fails to roll off the tongue. The term _Attention Economy_ is used to refer to many 
things. It's most canonical use is in reference to the advertising driven economy
underlying the web as it generally exists today. But separate alternative interpretations of "Attention Economy" have also been provided by a variety 
of self-interested
hucksters and shysters such as eg. Synereo (by whom the writer was unfortunate enough to have been previously employed), Steem and so on, 
who in general wish to disrupt the prevailing order, for motives that must be considered questionable at best.
  
By way of contrast, our intention is that eqURLity should forever remain a __completely advertising-free__ zone, where participants instead
choose to market themselves and their content directly to each other in an authentic, symmetric and completely transparent manner. 

To this end, the economic mechanisms employed need to be transparent and auditable, fair and equitable, and serve to ensure that the predominant 
economic beneficiaries
of content creation should always be the content creators themselves. At this point, our ideas of how to actually achieve this noble goal, 
whilst simultaneously ensuring that the platform
itself can be self-sustaining, remain nascent and open to further development and refinement. The fundamental motivating idea (currently) is 
to mandate that micro-payments be made directly from the content consumer to the content creator at the time of consumption. 

Moreover we intend to explicitly purloin the best ideas 
we can find from other related endeavours as we discover them.  To this end, we have attempted to incorporate and integrate ideas from Synereo and Steem,
and also from Res(o)nate.  From Res(o)nate we have adopted the idea of "stream-to-own" micro-payment schedules, which we have augmented with the additional 
twist of supporting negative payments (ie. from the _Creator_ to the _Consumer_) for initial streams, as our platform's analogue for paid 
advertising.  From Synereo (and Steem), we have attempted 
to explicitly recognize a role in the Intention Economy for _Curators_ in addition to the aforementioned creators and consumers.  

In order to allow micro-payments to take place, there has to be _some_ form of currency involved.  It is our clear preference _not_ to provide
our own currency for micro-payments.  Instead, we hope eventually to choose an appropriate crypto-currency (or possibly several) for this purpose.
As yet, we have not done so, there currently being no obvious candidate that has achieved widespread adoption. In the meantime, we will maintain a 
notional internal "credits" amount for each user, allowing for the simulation of micro-payments until a viable platform can be chosen and implemented. 
However, it is at least _possible_ that this might eventually evolve into a currency of it's own (and if it does so, we hereby claim the name "PseudoQoin"s 
for that currency).  Were this to eventuate, we envisage that eqURLity micro-transactions would effectively be aggregated via 
PseudoQoin, and that some exchange facility to and from other crypto-currencies then be provided.  This would of course introduce all sorts of legal issues,
not to mention the security issues introduced by having to maintain what would effectively a "hot-wallet" facility for PseudoQoins.  For these reasons we would
prefer to simply defer to other micro-payments platforms if possible, and absolve ourselves of such concerns. In this scenario, a user would be required to 
to supply a wallet address for the selected payments platform, and eqURLity would simple query that address for balances, and post transactions to it, 
so that no balance information need be maintained internally. 


The software is currently in alpha testing, and is not yet generally available. If you are curious about participating in our little experiment,
you are welcome to contact me, Gary Stephenson via [email](mailto:gary@oxide.net.au?Subject=eqURLity).
`;


const howItWorks: string = `
### The Intention Economy - How it Works (... maybe!)

In the discussion below, we identify three different roles that users of the eqURLity system might inhabit.  At the moment, the system allows each and every
user to inhabit each of the roles as they so choose.  We intend to change this in the near future, such that the Creator role is constrained somewhat, and 
will only be available via invitation (presumably from other Creators).  The exact details of how this will work are yet to be finalized.

There are many finer details we have chosen to gloss over here for want of space and not wishing to overwhelm the reader with too much detail.  There
are also many issues needing to be addressed before the system makes any sense from an economic perspective.  Probably the most pressing such 
issue is to figure out how to allow the system to pay for itself in terms of operating and maintenance costs, including the 
provision of an initial stake (currently 1000 credits) to new users.  Ideally, the system could finance itself out of taxing the stream-to-own / pay-per-view 
micro-payments stake.  We are open to suggestions and discussion about this issue, 
which will really need to be properly addressed if the system is ever to truly be taken seriously.

#### For Creators.

eqURLity is predominantly intended to be a platform for content creators to self-publish themselves.  Such content can be of any type - video, audio, image,
or text (post).  

The first step is to download and install the software.  At the moment, this requires the installation of the eqURLity extension into your Chrome browser from
the Google Play Store.  The Google account used to install the software is also used as your identity within the eqURLity application.

You are now able to create and/or upload your content.  In the case of textual content (ie. blog post), it is required to be in Markdown format, and
can be created online using the provided Markdown editor, or even pasted therein. Otherwise the content can be uploaded from the Contents screen 
of the extension's Home Page. Each content creates an entry in your Contents page, which can be further elaborated with tags, track credits, title, 
description and so on.

Each Content entry is automatically assigned it's own unique URL which can be 
used directly from this screen to generate a viewing page allowing the creator to freely consume their own creations, and moreover to preview how they will appear 
to potential consumers.  Note that content URLs are intended to be usable only by the creator (and internally by the system itself to service "Shares" - see below).

A Creator can elect to publish any content entry by clicking "Share" from it's dropdown actions menu.  This will present a configuration screen 
allowing details such as tags, title, description etc. to be customized for the Share URL about to created. In the case of streaming media 
(audio and video) a custom stream-to-own payment schedule for that Share (a la Res(o)nate) can also be specified. Notice that a single content item can be 
used to create as many different Shares as desired. This provides the opportunity to customise each Share for particular prospective audiences (Consumers) 
with distinct details, and may thereby also assist with analytics by providing different, easily identifiable and auditable access paths to the same content.

On clicking "Save", an eqURLity Share URL is created, which can then be copied and forwarded to others as desired. The system will also itself 
automatically forward the created link to the eqURLity home page, the creator's specific eqURLity page, and to other users who 
have subscribed to the creator's feed from their Settings page.  

#### For Consumers 

Consumers are potentially anybody who has installed the eqURLity software.  (Currently, the very act of installing the eqURLity extension creates a new user
account and initializes that account with 1000 credits.  Any or all of this may well change in the future.)

Consumers are able to see extra information on the eqURLity home page such as recently
published (Shared) content, and other eqURLity Creator's public details.  They might then choose to browse through to said Creators' eqURLity pages, and/or
subscribe to selected creator's feeds (ie. Shares published by that creator).  Consumers are also able to subscribe to specific "Tags", meaning that their feed will
include any content that is tagged with any of their subscribed tags, regardless of type, description or creator.

From any of these locations,
they can click on Shared URLs which will take them to the relevant content's page. If the content is streamable, and they decide to "play" it, 
they will commence on the "stream-to-own" schedule for that Share.  It is important to note that the direction of the payment can go in either direction here:
from Consumer to Creator, but also from Creator to Consumer! This is probably best explained with an example.

Let's assume that the Creator has attached a "stream-to-own" schedule of "-5,0,5,50,100" to the Share.  What this means is that:
- for the first stream, the Creator will pay the Consumer 5 credits,
- for the second stream, no payment will be made,
- for the third stream, the Consumer will pay the Creator 5 credits,
- for the fourth stream, the Consumer will pay the Creator 50 credits,
- and for the fifth stream, the Consumer will pay the Creator 100 credits.

At the point of payment for the fifth stream, the Consumer is now deemed to "own" the content, and a new content entry is created in their Contents screen
thereby allowing subsequent streams ad infinitum for free.  Note that not even the original Creator has the power to 
remove that newly-created content.  Even if the 
original Creator were to delete the original Content from their own contents page, and/or the original Share created therefrom, it will _still_ continue to 
exist in the Consumer's contents page.  It really is "stream-to-OWN" in that sense.

#### For Curators 

(NB: the following remains a bit contentious and speculative.  The system basically functions as described below, but we're not at all convinced that
it actually should!)

The other potential advantage that ensues for a Consumer that has purchased some content via the "stream-to-own" mechanism outlined above, is that they 
might then choose to "Share" that newly minted content themselves, albeit they are not the actual creator thereof.

To do this, simply select "Share" for such a purchased content from the dropdown actions menu just as for any content entry.
The system recognizes that the current user is acting here as a Curator (and not a Creator), and hence does not offer the option 
for specifying a separate stream-to-own payment schedule.

Otherwise, the generated Share URL functions in much the same way as if being published by it's Creator, except that it records the source URL it was generated 
from as it's "parent" - thus forming a chain back to the original Share (and Content).  From then on, whensoever a Consumer is paying "stream-to-own" payments to the content 
creator via this Share (or any of it's 'descendants' recursively), they will also pay a single additional credit to this Curator.  Note that this will be 
dynamically reflected
in the Consumer's interface such that the additional "Curation" charges will be automatically added on to the payment schedule presented to the consumer.
So for a consumer looking at a Share that is four levels deep in the curation chain, they will see each and every (positive) leg of the payment schedule 
as costing four more credits than
the original schedule specified.  It remains a moot point whether the same logic might also be applied to the negative legs of
the schedule.  Currently it is not so.

#### Redeeming Shares

All micro-payments in the "stream-to-own" activity are paid into and out of a balance maintained in the Share entries themselves.  At any stage 
you can review all the Shares you currently have, along with their current balances,
by selecting the "Shares" option from the home page. 

From there you can also choose to "redeem" any such shares, such that the entire balance will be transferred back into your account (wallet?).  

When a Share is created with any negative legs, the creator is obliged to provide some credits to permit consumers to be paid for streaming 
those legs. This initial balance represents the limit of the exposure the creator is subject to when offering to subsidise the consumption of content
in this way.  Note that if a Share is published with any negative legs, and the balance goes to zero for whatever reason, those negative legs will henceforth 
display as being zero, unless and until a sufficiently positive balance is restored to the Share.  Adjustments to the balance (in either direction) 
can also be made from the Edit option of the dropdown actions menu.
`;

let _hiw = { __html: md.render(howItWorks) };
const howItWorksClause = <div dangerouslySetInnerHTML={_hiw} />;

let _ext_html = { __html: md.render(extension_md) };
const extensionClause = <div dangerouslySetInnerHTML={_ext_html} />;

interface LandingPageProps { subtitle?: string }
export const LandingPage: React.StatelessComponent<LandingPageProps> = props => {
  const pgStyle = { marginLeft: 20, marginRight: 20, marginTop: 70 };
  let { subtitle } = props;
  let btns = [
    <button key="qurlers" className="pt-button pt-minimal pt-icon-people"><a href={Utils.serverUrl + '/qurlers'}>qURLers</a></button>,
    <button key="how-it-works" className="pt-button pt-minimal pt-icon-info-sign"><a href={Utils.serverUrl + '/how-it-works'}>How It Works</a></button>,
    <button key="about" className="pt-button pt-minimal pt-icon-help"><a href={Utils.serverUrl + '/about'}>About</a></button>,
  ];


  return <div style={pgStyle}>
    <NavBar buttons={btns} subtitle={subtitle} />
    <div style={{ marginTop: "60px" }} >
      {props.children}
    </div>
  </div>
}

export interface LinkLandingPageProps { url?: Dbt.urlString, userName: Dbt.userName }
export const LinkLandingPage = (props: LinkLandingPageProps) => {
  let url = props.url;
  let hpurl = Utils.homePageUrl(props.userName);
  let footer = <p>The link was generated by user: <a href={hpurl}>{props.userName}</a></p>;
  let linkClause = url ? `<p>This is the link you were after: <a href="${url}">${url}</a></p>` : null;
  return (
    <LandingPage>
      <p>You have attempted to follow an eqURLity link, but the eqURLity chrome browser extension is not active.</p>
      {linkClause}
      {footer}
    </LandingPage>
  );
};

export interface ContentLandingPageProps { userName: Dbt.userName }
export const ContentLandingPage = (props: ContentLandingPageProps) => {
  let hpurl = Utils.homePageUrl(props.userName);
  let footer = <p>The content was created by user: <a href={hpurl}>{props.userName}</a></p>;
  return (
    <LandingPage>
      <p>You have attempted to access an eqURLity content url, but the eqURLity chrome
        extension is not available.  If you wish to access this content, you will need to install our extension.</p>
      {footer}
    </LandingPage>
  );
};

export interface UserLandingPageProps { user: Dbt.User, clientId: Dbt.userId, isFollowing: boolean }
export const UserLandingPage: React.StatelessComponent<UserLandingPageProps> = props => {
  let { user, clientId, isFollowing } = props;
  if (!clientId) return <div>
    <p>You do not currently have the eqURLity client software installed.</p>
  </div>;
  let info = null;
  let sub = isFollowing ? <a href={Utils.serverUrl + "/unfollow/" + user.userName} >Unfollow</a>
    : <a href={Utils.serverUrl + "/follow/" + user.userName} >Follow</a>
  if (user.info) {
    let h = { __html: md.render(user.info) };
    info = <div dangerouslySetInnerHTML={h} />;
  }
  else {
    info = user.home_page ? <a href={user.home_page} target="_blank">{user.home_page}</a> : "No profile information provided.";
  }
  return (
    <LandingPage subtitle={"qURLer Info : " + user.userName} >
      <Row>{info}</Row>
      <Row><Button>{sub}</Button></Row>
    </LandingPage>
  );
};

export interface AboutPageProps { isClient: boolean }
export const AboutPage: React.StatelessComponent<AboutPageProps> = props => {
  return (
    <LandingPage>
      <Row><h2>About eqURLity</h2></Row>
      <Row justify="end"><i>-- &quot;There's equity around them thar URLs!&quot;</i></Row>
      {extensionClause}
    </LandingPage>
  );
};

export interface HowItWorksProps { isClient: boolean }
export const HowItWorksPage: React.StatelessComponent<HowItWorksProps> = props => {
  return (
    <LandingPage>
      {howItWorksClause}
    </LandingPage>
  );
};

