import { AudioPlayer, VideoPlayer } from '../lib/mediaPlayer';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import * as Dbt from '../lib/datatypes';
import * as Rpc from '../lib/rpc';

import { CommentsPanel } from '../lib/comments';

interface MediaPageProps { mime: string, contentId: Dbt.contentId };
interface MediaPageState { comments: Rpc.CommentItem[] };
export class MediaPage extends React.Component<MediaPageProps, MediaPageState> {

  constructor(props) {
    super(props);
    this.state = { comments: [] };
  }

  render() {
    let { contentId, mime } = this.props;

    const opts: any = {
      autoplay: true,
      controls: true,
      sources: [{
        src: '/stream/content/' + contentId,
        type: mime
      }]
    }

    let viewer = mime.startsWith("audio") ? <AudioPlayer options={opts} />
      : mime.startsWith("video") ? <VideoPlayer options={opts} />
        : <p>Invalid mime type</p>;

    return <div>
      {viewer}
      <CommentsPanel comments={this.state.comments} />
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