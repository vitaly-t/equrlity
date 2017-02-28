import * as React from "react";
import * as ReactDOM from "react-dom";
import { PostView } from "../lib/postview";
import * as Dbt from "../lib/datatypes";

const extensionClause = <div>
  <p>This extension is an experimental implementation of an <b>Attention Economy</b>, as outlined in the Synereo Vision paper (link please?).</p>
  <p>The latest release can be downloaded by clicking either of these links:</p>
  <ul>
    <li><a href="/download/synereo.zip" download >Zip file (Windows)</a></li>
    <li><a href="/download/synereo.tar.gz" download >Tar.gz file (Linux  / Mac)</a></li>
  </ul>
  <p>To install it you will have to unzip/untar the file into a directory, then go in to your
Chrome extensions page, and select "Load unpacked extension".</p>
  <p>You may need to first tick the "Developer Mode" box (top right) to allow unpacked extensions to load.
If you wish, you can then untick it again once the extension has been installed.)</p>
  <p>To upgrade an existing installation, simply overwrite the existing files with the new ones, and select "Reload" in the extensions page.</p>
  <p>Note that if you disable the extension for any reason, when you re-enable it you will also need to click "Reload" again.</p>
</div>
const header = (<h2>Welcome to Synereo</h2>);
const footer = (<p>Proudly brought to you by NotQuiteAsUglyAsOnceItWas Interfaces Ltd. (C) 2005. All rights reserved</p>);

export const LinkLandingPage = (props) => {
  let url = props.url;
  let linkClause = url ? <p>This is the link you were (probably) after: <a href="{url}">{url}</a></p> : null;
  return (
    <div style={{ marginLeft: 3, marginRight: 3 }}>
      {header}
      <p>You have followed a Synereo link.  If you can see this message (for more than a second or so)
it probably means you do not have the Synereo browser extension installed.</p>
      {extensionClause}
      {linkClause}
      {footer}
    </div>
  );
};

export const HomePage = (props) => {
  return (
    <div style={{ marginLeft: 3, marginRight: 3 }} >
      {header}
      <p>Welcome to the home page of the Synereo Chrome extension.</p>
      {extensionClause}
      {footer}
    </div>
  );
};

