import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import { VideoPlayer, AudioPlayer } from '../lib/mediaPlayer';
//import { AudioPlayer } from '../lib/audioPlayer';
import { PeaksPlayer } from '../lib/reactPeaks';
import * as Comms from '../lib/axiosClient';
import { CommentsPanel, CommentEditor } from '../lib/comments';
import { ContentView } from '../lib/contentView';
import buildWaveform from '../lib/buildWaveform';

async function saveWaveForm(contentId: Dbt.contentId) {
  let src = '/blob/content/' + contentId;
  let req = Comms.clientRequest({ responseType: 'arraybuffer' });
  let response = await req.get(Utils.serverUrl + src);
  let buf: ArrayBuffer = response.data;
  let peaks = await buildWaveform(buf);
  let req2: Rpc.CachePeaksRequest = { contentId, peaks }
  Comms.sendApiRequest('cachePeaks', req2)
}

interface MediaPageProps { mime: string, contentId: Dbt.contentId, linkId: Dbt.linkId };
interface MediaPageState {
  privKey: JsonWebKey, owner: Dbt.userName, moniker: Dbt.userName, comments: Rpc.CommentItem[], credits: Dbt.integer,
  content: Dbt.Content, paymentSchedule: Dbt.paymentSchedule, streamNumber: Dbt.integer, peaks: boolean, linkDepth: Dbt.integer
};
export class MediaPage extends React.Component<MediaPageProps, MediaPageState> {

  constructor(props) {
    super(props);
    this.state = { privKey: null, comments: [], owner: '', moniker: '', content: null, paymentSchedule: [], streamNumber: 0, peaks: false, linkDepth: 0, credits: 0 };
  }

  fetchData = async () => {
    let req = Comms.clientRequest();
    let url = this.props.linkId ? '/load/link/' + this.props.linkId : '/load/content/' + this.props.contentId;
    let response = await req.get(Utils.serverUrl + url);
    let privKey: JsonWebKey;
    let moniker: string;
    let pk = response.headers['x-psq-privkey']
    if (pk) {
      privKey = JSON.parse(pk);
      moniker = response.headers['x-psq-moniker'];
    }
    let rsp: Rpc.Response = response.data;
    if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
    let rslt: Rpc.LoadContentResponse = rsp.result;
    let { content, comments, owner, paymentSchedule, streamNumber, peaks, linkDepth, credits } = rslt;
    this.setState({ content, privKey, comments, owner, moniker, paymentSchedule, streamNumber, peaks, linkDepth, credits });
    if (!peaks) saveWaveForm(content.contentId);

  }

  componentDidMount() {
    this.fetchData();
  }

  purchaseCost() {
    let { paymentSchedule, streamNumber, linkDepth } = this.state;
    let purchaseCost = linkDepth;
    if (streamNumber > 0) {
      let i = streamNumber - 1;
      while (i < paymentSchedule.length) {
        purchaseCost += paymentSchedule[i];
        ++i;
      }
    }
    return purchaseCost;
  }

  purchaseContent = async (): Promise<boolean> => {
    if (!this.props.linkId) return true;
    let req: Rpc.PayForViewRequest = { linkId: this.props.linkId, purchase: true, amount: this.purchaseCost() };
    let response = await Comms.sendApiRequest('payForView', req);
    let rsp: Rpc.Response = response.data;
    if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
    let rslt: Rpc.PayForViewResponse = rsp.result;
    if (rslt.ok) this.setState({ streamNumber: this.state.paymentSchedule.length + 1 });
    return rslt.ok;
  }

  onFirstPlay = async (): Promise<boolean> => {
    if (!this.props.linkId) return true;
    let { paymentSchedule, streamNumber, linkDepth } = this.state;
    let amount = 0;
    if (paymentSchedule && paymentSchedule.length > 0 && streamNumber && streamNumber <= paymentSchedule.length) amount = paymentSchedule[streamNumber - 1];
    if (amount >= 0) amount += linkDepth;
    let req: Rpc.PayForViewRequest = { linkId: this.props.linkId, amount };
    let response = await Comms.sendApiRequest('payForView', req);
    let rsp: Rpc.Response = response.data;
    if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
    let rslt: Rpc.PayForViewResponse = rsp.result;
    if (rslt.ok) this.setState({ streamNumber: this.state.streamNumber + 1 });
    return rslt.ok;
  }

  render() {
    let { contentId, mime, linkId } = this.props;
    let { content, privKey, comments, owner, moniker, paymentSchedule, streamNumber, peaks, linkDepth, credits } = this.state;
    if (!content) return null;
    let blobsrc = linkId ? '/blob/link/' + linkId : '/blob/content/' + contentId;
    let strmsrc = linkId ? '/stream/link/' + linkId : '/stream/content/' + contentId;
    let peaksUri;
    let isAnonymous = linkId && streamNumber > 0 && paymentSchedule && streamNumber < paymentSchedule.length;
    if (peaks) peaksUri = Utils.serverUrl + (linkId ? '/blob/link/peaks/' + linkId : '/blob/content/peaks/' + contentId);
    let gutter = 10;
    let cont = <ContentView info={content} owner={owner} />;
    if (isAnonymous) {
      comments = [];
      cont = <div style={{ marginLeft: "20px" }}>
        <p />
        <h4>Anonymous {mime.startsWith("audio") ? "listening" : "viewing"}.</h4>
        <p>The details associated with this content, including comments made by others, remain hidden unless and until you have completed the &quot;Stream to Own&quot; schedule.</p>
        <p>The idea is for you to experience and evaluate the content as directly as possible, with the least possibility of being influenced by prior conceptions, opinions of others,
        and so on.</p>
        <p>During this period, we encourage you to make whatever comments you wish, in the hope that said comments will be of maximum objectivity and authenticity
          given the lack of biasing information and context.</p>
      </div>
    }
    let viewer = mime.startsWith("image") ? <img src={blobsrc} />
      //: mime.startsWith("audio") ? <AudioPlayer src={strmsrc} type={mime} streamToOwnCost={streamToOwnCost} /> // audioplayer.tsx
      : mime.startsWith("audio") ? <PeaksPlayer src={blobsrc} type={mime} paymentSchedule={paymentSchedule} streamNumber={streamNumber} peaksUri={peaksUri}
        purchaseCost={this.purchaseCost()} onPurchase={this.purchaseContent} onFirstPlay={this.onFirstPlay} linkDepth={linkDepth} credits={credits} />
        : mime.startsWith("video") ? <VideoPlayer /*poster='???'*/ src={strmsrc} type={mime} />
          : null; //<p>Invalid mime type</p>;

    return <div>
      <Row gutter={gutter}>
        <Col span={3}>{viewer}</Col>
        <Col span={8}>{cont}</Col>
      </Row>
      <Row gutter={gutter}><h5 style={{ marginTop: "10px" }} >Comments:</h5></Row>
      <Row gutter={gutter}>
        <Col span={12}>
          <CommentsPanel contentId={contentId} comments={comments} privKey={privKey} canCensor={moniker === owner} userName={moniker} />
        </Col>
      </Row>
    </div>
  }

}

function render() {
  let elem = document.getElementById('app')
  if (!elem) throw new Error("cannot get app element");
  let mime = elem.dataset.mimeType;
  let contentId = elem.dataset.contentId;
  let linkId = elem.dataset.linkId;
  ReactDOM.render(<MediaPage mime={mime} contentId={contentId} linkId={linkId} />, elem);
}

document.addEventListener('DOMContentLoaded', () => {
  render();
});