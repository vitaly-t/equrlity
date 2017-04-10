import * as React from 'react';
import { AppState, expandedUrl, isWaiting, getLinked } from "./AppState";
import { Url, format } from 'url';
import Form from 'react-input';
import * as Rpc from '../lib/rpc'
import { capuchinVersion, serverUrl } from '../lib/utils';
import * as Chrome from './chrome';

export interface PopupPanelProps { appState?: AppState; serverMessage?: string };
export interface PopupPanelState { promoteAmount: number, description: string };

export class PopupPanel extends React.Component<PopupPanelProps, PopupPanelState> {

  constructor(props) {
    super(props);
    this.state = { promoteAmount: 20, description: props.appState.activeUrl };
  }

  ctrls: { amountInput?: HTMLInputElement, descriptionInput?: HTMLInputElement } = {}

  changePromoteAmount() {
    this.setState({ promoteAmount: parseInt(this.ctrls.amountInput.value) });
  }

  changeDescription() {
    this.setState({ description: this.ctrls.descriptionInput.value });
  }

  render() {
    let props = this.props;
    if (props.serverMessage) {
      console.log("rendering server message...");
      return <div>Server error: {props.serverMessage} </div>;
    }
    let st = props.appState;
    let curl = st.activeUrl
    if (curl && isWaiting(st, curl)) {
      console.log("rendering waiting for response...");
      return <div>Waiting for response from Server</div>;
    }
    console.log("rendering popup...");
    let versionDiv = (<p>Version: {capuchinVersion()}.</p>);

    if (st.lastErrorMessage) return <div>Error: {st.lastErrorMessage}</div>
    let pnl = <div>No active URL found</div>
    if (curl) {
      let tgt = expandedUrl(st);
      let desc = this.state.description;
      console.log("rendering for target :" + tgt);
      let linkInfo = getLinked(st, curl);
      let lbl = linkInfo ? (linkInfo.linkPromoter === st.moniker ? "Re-Invest" : "Re-Promote") : "Promote";
      let saveaction = () => {
        let amount = this.state.promoteAmount;
        let linkDescription = this.state.description
        Chrome.sendMessage({ eventType: "PromoteLink", amount, linkDescription });
      }
      let infoDiv = linkInfo ? <div>{`Promoted by: ${linkInfo.linkPromoter}, Link depth : ${linkInfo.linkDepth}`}</div> : null;
      let costPerView = linkInfo ? linkInfo.linkDepth + 1 : 1;
      pnl = (<div>
        <p>Target : <textarea style={{ width: 450 }}>{tgt}</textarea></p>
        {infoDiv}
        <p>Investment amount: <input type="number" ref={(e) => this.ctrls.amountInput = e} max={st.credits}
          value={this.state.promoteAmount} onChange={(e) => this.changePromoteAmount()} /></p>
        <p>This will provide for a maximum of {Math.floor(this.state.promoteAmount / costPerView)} promotions.</p>
        <p>Description: <input type="string" style={{ width: 400 }} ref={(e) => this.ctrls.descriptionInput = e}
          value={desc} onChange={(e) => this.changeDescription()} /></p>
        <button onClick={saveaction} >{lbl}</button>
      </div>);
    }
    let settingsAction = () => Chrome.sendMessage({ eventType: "LaunchSettingsPage" });
    return <div>
      <p>Using Server Url: {serverUrl} </p>
      <p>Your PseudoQURL Nickname is: {st.moniker}</p>
      <p>Your current Account Balance is: {st.credits}</p>
      <p><button onClick={settingsAction}>View/Edit Settings</button></p>
      {pnl}
      {versionDiv}
    </div>
  }
}
