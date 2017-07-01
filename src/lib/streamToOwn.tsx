import * as React from 'react';
import { Row, Col } from 'react-simple-flex-grid';
import { Button } from '@blueprintjs/core';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';

interface StreamToOwnProps { paymentSchedule: Dbt.paymentSchedule, streamNumber: Dbt.integer, purchaseCost: Dbt.integer, onPurchase: () => void };
interface StreamToOwnState { };
export class StreamToOwn extends React.Component<StreamToOwnProps, StreamToOwnState> {

  constructor(props) {
    super(props);
    this.state = { paymentSchedule: [], streamNumber: 1 };
  }

  render() {
    let { streamNumber, paymentSchedule, purchaseCost } = this.props;
    let cost = 0;

    let purch = null;
    if (streamNumber > 0 && streamNumber <= paymentSchedule.length) {
      cost = paymentSchedule[streamNumber - 1];
      if (streamNumber === paymentSchedule.length) purch = <p>After paying for this stream, you will have completed purchase of this content.</p>;
      else {
        purch = <div>
          <p>This content can be purchased outright for a payment of {purchaseCost} PseudoQoins.</p>
          <Button text="Purchase" onClick={() => this.props.onPurchase()} />
        </div>
      }
    }
    let cont = cost === 0 ? <p>This stream is free to play.</p>
      : cost > 0 ? <p>Playing this stream will cost you {cost} PseudoQoins.</p>
        : <p>Playing this stream you will credit you with  {-cost} PseudoQoins.</p>
    return <div>
      {cont}
      {purch}
    </div>
  }
}