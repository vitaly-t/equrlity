import * as React from 'react';
import * as ReactDOM from "react-dom";
import { Button } from "@blueprintjs/core";
import axios, { AxiosResponse, AxiosError } from 'axios';
import * as Select from 'react-select';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import * as Constants from '../lib/constants';
import { btnStyle, lhcolStyle } from "../lib/constants";
import { Row, Col } from '../lib/components';
import { sendApiRequest } from '../lib/axiosClient';

import { AppState } from "./AppState";
import { PanelContext } from "./home";
import * as Chrome from './chrome';

interface TransferCreditsProps { appState: AppState, panelContext: PanelContext };
interface TransferCreditsState { transferAmount: number, transferTo: string };

export class TransferCreditsPanel extends React.Component<TransferCreditsProps, TransferCreditsState> {

  constructor(props: TransferCreditsProps) {
    super(props);
    this.state = { transferAmount: 0, transferTo: '' };
  }

  changeTransferAmount(value: string) { this.setState({ transferAmount: parseInt(value) }); }
  changeTransferTo(value: string) {
    this.setState({ transferTo: value });
  }

  render() {
    let st = this.props.appState;
    let panelContext = this.props.panelContext;
    let { vsp, toast } = panelContext;
    let invs = st.shares;

    let transfer = async () => {
      let amount = this.state.transferAmount;
      let transferTo = this.state.transferTo;
      let req: Rpc.TransferCreditsRequest = { transferTo, amount };
      if (amount > 0 && transferTo) {
        await sendApiRequest("transferCredits", req);
        this.setState({ transferAmount: 0, transferTo: '' });
      }
    };

    return (
      <div>
        <h6>Your Current Wallet Balance is : {st.user.credits} credits.</h6>
        {vsp}
        <p>If you wish, you can transfer credits to another user.</p>
        <Row align="middle">
          <div style={{ display: 'inline' }}>Amount to Transfer: </div>
          <input type="number" style={{ display: 'inline', height: 24, marginLeft: 20, marginTop: 6, width: '100px' }}
            value={this.state.transferAmount} onChange={e => this.changeTransferAmount(e.target.value)} />
          <div style={{ display: 'inline', marginLeft: 20 }}>Transfer To: </div>
          <Select key="__sel__" style={{ display: 'inline-block', width: '150px', height: '26px', marginLeft: '3px' }} value={this.state.transferTo} options={this.props.appState.userNames} onChange={v => this.changeTransferTo(v.value)} />
          <Button key='transfer' className="pt-intent-primary" style={{ display: 'inline', marginLeft: 20 }} onClick={() => transfer()} text="Transfer" />
        </Row>
      </div>);
  }
}

