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
import { CommentsPanel } from '../lib/comments';
import { ContentView } from '../lib/contentView';

import * as webAudioBuilder from 'waveform-data/webaudio';

export async function buildWaveform(url: Dbt.urlString, cb: (wf: any) => void) {
  let req = Comms.clientRequest();
  let response = await req.get(Utils.serverUrl + url);
  let buffer: ArrayBuffer = response.data;
  const audioContext = new AudioContext();

  webAudioBuilder(audioContext, buffer, (error, waveform) => {
    console.log(waveform.duration);
    //cb(waveform)
  });
}



interface MediaPageProps { mime: string, contentId: Dbt.contentId, linkId: Dbt.linkId };
interface MediaPageState { privKey: JsonWebKey, owner: Dbt.userName, moniker: Dbt.userName, comments: Rpc.CommentItem[], content: Dbt.Content, paymentSchedule: Dbt.paymentSchedule, streamNumber: Dbt.integer };
export class MediaPage extends React.Component<MediaPageProps, MediaPageState> {

  constructor(props) {
    super(props);
    this.state = { privKey: null, comments: [], owner: '', moniker: '', content: null, paymentSchedule: [], streamNumber: 0 };
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
    let { content, comments, owner, paymentSchedule, streamNumber } = rslt;
    this.setState({ content, privKey, comments, owner, moniker, paymentSchedule, streamNumber });
  }

  componentDidMount() {
    this.fetchData();
  }

  render() {
    let { contentId, mime, linkId } = this.props;
    let { content, privKey, comments, owner, moniker, paymentSchedule, streamNumber } = this.state;
    let blobsrc = linkId ? '/blob/link/' + linkId : '/blob/content/' + contentId;
    //buildWaveform(blobsrc, null);
    let strmsrc = linkId ? '/stream/link/' + linkId : '/stream/content/' + contentId;
    let viewer = mime.startsWith("image") ? <img src={blobsrc} />
      //: mime.startsWith("audio") ? <AudioPlayer src={strmsrc} type={mime} streamToOwnCost={streamToOwnCost} /> // audioplayer.tsx
      : mime.startsWith("audio") ? <PeaksPlayer src={blobsrc} type={mime} paymentSchedule={paymentSchedule} streamNumber={streamNumber} />
        : mime.startsWith("video") ? <VideoPlayer /*poster='???'*/ src={strmsrc} type={mime} />
          : null; //<p>Invalid mime type</p>;

    let gutter = 10;
    let cont;
    if (content) cont = <ContentView info={content} owner={owner} />;
    return <div>
      <Row gutter={gutter}>
        <Col span={3}>{viewer}</Col>
        <Col>{cont}</Col>
      </Row>
      <Row gutter={gutter}><h5 style={{ marginTop: "10px" }} >Comments:</h5></Row>
      <Row gutter={gutter}>
        <Col span={12}>
          <CommentsPanel contentId={contentId} comments={this.state.comments} privKey={privKey} canCensor={moniker === owner} userName={moniker} />
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