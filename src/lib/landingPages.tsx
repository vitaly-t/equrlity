import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Remarkable from 'remarkable';

import { ContentView } from "../lib/contentView";
import * as Dbt from "../lib/datatypes";
import * as Utils from "../lib/utils";

const md = new Remarkable({ html: true });

const howItWorks: string = `
### How it Works

If you have a page opened that you would like to invest in, open the extension popup screen with your
chosen tab selected, and choose the amount you wish to invest.  

If the URL of the page has not previously been Promoted by anyone - congratulations, you have first-mover advantage! Simply set your investment amount and click on Promote.

If the url has already been Promoted by someone else, you will be offered the option to "Re-Promote" the
displayed PseudoQ URL, which promotes the displayed URL as opposed to the original URL itself.

In either the case, the effect of Promoting will be to create a PseudoQURL link url, which you can then copy
and forward to others as you see fit.  The system will itself automatically forward the created link to other contacts in your PseudoQURL social graph.  
The generated link records the URL it was generated from as it's "parent link" - thus forming a chain of links back to the 
original content.

If you have already (re-)Promoted the content previously, the link you previously created will be displayed, 
and any investment you choose to make will simply be used to increase the balance in that link.

#### Views

The amount you invested in the link will be used to make payments to other users who follow the link 
(ie. open the page). The viewer of the link will be paid 1 credit for providing their attention.  

If the link has a parent, that parent link will also get paid 1 credit, and so on back up the chain. So if a link
has four parents, each view will decrement the balance by 5, 1 going to the viewer, and 1 going to each of the four links in the parent chain.

If the viewer so wishes, they can choose to Re-Promote the link you sent them, thereby creating another link belonging to the viewer.  
That newly created link will have your link as it's parent, so that you will receive payment from any views generated through that link.

Once the balance in a link drops to zero, it will be automatically removed from the system 
(with any child links re-parented appropriately).

#### Redeeming links

At any stage you can review all the links you currently have investments in, along with their current balances,
by clicking on the "Edit / View Settings" button in the extension popup.
From there you can also choose to "redeem" any such links, such that the balance will be transferred back into your account,
and the link removed.
`;

let _hiw = { __html: md.render(howItWorks) };
const howItWorksClause = <div dangerouslySetInnerHTML={_hiw} />;
const pgStyle = { marginLeft: 20, marginRight: 20 };

const extensionClause = <div>
  <p>The chrome extension is an experimental implementation of an <b>Intention Economy</b>.  This is in contrast to an <i>Attention</i> economy, because that particular
  turn of phrase has become debased and derogatory due to the invasion of the space by hucksters and shysters (such as eg. Synereo - by whom the writer was unfortunate enough to have
  been previously employed).</p>
  <p>The latest release can be downloaded by clicking any of these links:</p>
  <ul>
    <li><a href="/download/pseudoqurl.zip" download >Zip file (Windows)</a></li>
    <li><a href="/download/pseudoqurl.tar.gz" download >Tar.gz file (Linux  / Mac)</a></li>
    <li><a href="/download/pseudoqurl.crx" download >Crx file (Chrome format)</a></li>
  </ul>
  <p>To install it you will have to unzip/untar the file into a directory, then go in to your
Chrome extensions page, and select "Load unpacked extension".</p>
  <p>You may need to first tick the "Developer Mode" box (top right) to allow unpacked extensions to load.
If you wish, you can then untick it again once the extension has been installed.</p>
  <p>To upgrade an existing installation, simply overwrite the existing files with the new ones, and select "Reload" in the extensions page.</p>
  <p>Note that if you disable the extension for any reason, when you re-enable it you will also need to click "Reload" again.</p>
</div>
const header = (<h2>Welcome to PseudoQURL</h2>);

export interface LinkLandingPageProps { link: Dbt.Link, userName: Dbt.userName }
export const LinkLandingPage = (props: LinkLandingPageProps) => {
  let url = props.link.url;
  let hpurl = Utils.homePageUrl(props.userName);
  let footer = <p>The link was generated by user: <a href={hpurl}>{props.userName}</a></p>;
  let linkClause = url && props.link.isPublic ? `<p>This is the link you were after: <a href="${url}">${url}</a></p>` : null;
  return (
    <div style={pgStyle}>
      {header}
      <p>You have attempted to follow a PseudoQURL link, but you do not have the PseudoQURL chrome browser extension active.</p>
      {extensionClause}
      {howItWorksClause}
      {linkClause}
      {footer}
    </div>
  );
};

export interface ContentLandingPageProps { userName: Dbt.userName }
export const ContentLandingPage = (props: ContentLandingPageProps) => {
  let hpurl = Utils.homePageUrl(props.userName);
  let footer = <p>The content was created by user: <a href={hpurl}>{props.userName}</a></p>;
  return (
    <div style={pgStyle}>
      {header}
      <p>You have attempted to access a PseudoQURL content url, but the PseudoQURL chrome
        extension is not available.  If you wish to access this content, you will need to install and activate our extension.
      </p>
      {extensionClause}
      {howItWorksClause}
      {footer}
    </div>
  );
};

export interface UserLandingPageProps { user: Dbt.User, email: string, isClient: boolean }
export const UserLandingPage = (props: UserLandingPageProps) => {
  let qurlinfo = null;
  let { user, email, isClient } = props;
  let userLink = user.home_page ? <a href={user.home_page} target="_blank">{user.home_page}</a> : "Not provided";
  let info = null;
  if (user.info) {
    let h = { __html: md.render(user.info) };
    info = <div dangerouslySetInnerHTML={h} />;
  }
  if (!isClient) qurlinfo = <div>
    <p>You do not currently have the PseudoQURL Chrome extension running.</p>
    {extensionClause}
    {howItWorksClause}
  </div>
  return (
    <div style={pgStyle} >
      <h3>PseudoQURL contact information for: {user.userName}.</h3>
      <p>Home page: {userLink}</p>
      <p>Email: {email ? email : 'Not provided'}</p>
      {info}
      {qurlinfo}
    </div>
  );
};


export const HomePage = () => {
  return (
    <div style={pgStyle} >
      {header}
      <p>Welcome to the home page of the PseudoQURL Chrome extension.</p>
      {extensionClause}
      {howItWorksClause}
    </div>
  );
};

