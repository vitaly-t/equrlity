import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import { VideoPlayer } from '../lib/mediaPlayer';
import { AudioPlayer } from '../lib/audioPlayer';
import * as Comms from '../lib/axiosClient';
import { CommentsPanel } from '../lib/comments';
import { ContentView } from '../lib/contentView';

interface MediaPageProps { mime: string, contentId: Dbt.contentId };
interface MediaPageState { privKey: JsonWebKey, owner: Dbt.userName, moniker: Dbt.userName, comments: Rpc.CommentItem[], content: Dbt.Content };
export class MediaPage extends React.Component<MediaPageProps, MediaPageState> {

  constructor(props) {
    super(props);
    this.state = { privKey: null, comments: [], owner: '', moniker: '', content: null };
  }

  componentDidMount = async () => {
    let req = Comms.clientRequest();
    let response = await req.get(Utils.serverUrl + "/load/content/" + this.props.contentId);
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
    let { content, comments, owner } = rslt;
    this.setState({ content, privKey, comments, owner, moniker });
  }

  render() {
    let { contentId, mime } = this.props;
    let { content, privKey, comments, owner, moniker } = this.state;
    let src = '/stream/content/' + contentId;
    let viewer = mime.startsWith("image") ? <img src={src} />
      : mime.startsWith("audio") ? <AudioPlayer src={src} type={mime} />
        : mime.startsWith("video") ? <VideoPlayer /*poster='http://localhost:8080/stream/content/bA3jno'*/ src={src} mime={mime} />
          : null; //<p>Invalid mime type</p>;

    let gutter = 10;
    let cont;
    if (content) cont = <ContentView info={content} owner={owner} />;
    return <div>
      <Row gutter={gutter}>
        <Col>{viewer}</Col>
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
  ReactDOM.render(<MediaPage mime={mime} contentId={contentId} />, elem);
}

document.addEventListener('DOMContentLoaded', () => {
  render();
});