import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Row, Col } from 'react-simple-flex-grid';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import { AudioPlayer, VideoPlayer } from '../lib/mediaPlayer';
import * as Comms from '../lib/axiosClient';
import { CommentsPanel } from '../lib/comments';
import { ContentView } from '../lib/contentView';

interface MediaPageProps { mime: string, contentId: Dbt.contentId };
interface MediaPageState { privKey: JsonWebKey, owner: Dbt.userName, comments: Rpc.CommentItem[], content: Dbt.Content };
export class MediaPage extends React.Component<MediaPageProps, MediaPageState> {

  constructor(props) {
    super(props);
    this.state = { privKey: null, comments: [], owner: '', content: null };
  }

  componentDidMount = async () => {
    let req = Comms.clientRequest();
    let response = await req.get(Utils.serverUrl + "/load/content/" + this.props.contentId);
    let privKey: JsonWebKey = null;
    let pk = response.headers['x-psq-privkey']
    if (pk) privKey = JSON.parse(pk);
    let rsp: Rpc.Response = response.data;
    if (rsp.error) throw new Error("Server returned error: " + rsp.error.message);
    let rslt: Rpc.LoadContentResponse = rsp.result;
    let { content, comments, owner } = rslt;
    this.setState({ content, privKey, comments, owner });
  }

  render() {
    let { contentId, mime } = this.props;
    let { content, privKey, comments, owner } = this.state;

    const opts: any = {
      autoplay: false,
      controls: true,
      sources: [{
        src: '/stream/content/' + contentId,
        type: mime
      }]
    }

    let viewer = mime.startsWith("audio") ? <AudioPlayer options={opts} />
      : mime.startsWith("video") ? <VideoPlayer options={opts} />
        : <p>Invalid mime type</p>;
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
          <CommentsPanel contentId={contentId} comments={this.state.comments} privKey={this.state.privKey} />
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