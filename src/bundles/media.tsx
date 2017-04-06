import { AudioPlayer, VideoPlayer } from '../lib/mediaPlayer';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

function render() {
  let elem = document.getElementById('app')
  if (!elem) throw new Error("cannot get app element");
  let mime = elem.dataset.mimeType;

  const opts: any = {
    autoplay: true,
    controls: true,
    sources: [{
      src: '/stream/content/' + elem.dataset.contentId,
      type: mime
    }]
  }

  let viewer = mime.startsWith("audio") ? <AudioPlayer options={opts} />
    : mime.startsWith("video") ? <VideoPlayer options={opts} />
      : <p>Invalid mime type</p>;

  ReactDOM.render(viewer, elem);
}

document.addEventListener('DOMContentLoaded', () => {
  render();
});