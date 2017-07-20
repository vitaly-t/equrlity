import * as React from 'react';
import { Row, Col } from 'react-simple-flex-grid';
import { Button } from '@blueprintjs/core';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';

interface StreamToOwnProps { paymentSchedule: Dbt.paymentSchedule, streamNumber: Dbt.integer, linkDepth: Dbt.integer, purchaseCost: Dbt.integer, credits: Dbt.integer, onPurchase: () => Promise<boolean> };
interface StreamToOwnState { };
export class StreamToOwn extends React.Component<StreamToOwnProps, StreamToOwnState> {

  render() {
    let { streamNumber, paymentSchedule, purchaseCost, linkDepth, credits } = this.props;
    let cost = 0;

    let purch = null;
    let avail = null;
    if (streamNumber > 0 && streamNumber <= paymentSchedule.length) {
      cost = paymentSchedule[streamNumber - 1];
      if (streamNumber === paymentSchedule.length) purch = <p>After paying for this stream, you will have completed purchase of this content.</p>;
      else {
        purch = <div>
          <p>This content can be purchased outright for a payment of {purchaseCost} credits.</p>
          {purchaseCost <= credits && <Button text="Purchase" onClick={this.props.onPurchase} />}
        </div>
      }
      avail = <p>You currently have {credits} credits available.</p>
    }
    let cont = cost === 0 ? <p>This stream is free to play.</p>
      : cost > 0 ? <p>Playing this stream will cost you {cost + linkDepth} credits.</p>
        : <p>Playing this stream you will credit you with  {-cost} credits.</p>
    return <div>
      {cont}
      {purch}
      {avail}
    </div>
  }
}