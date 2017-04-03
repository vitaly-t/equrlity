import * as React from 'react';
import * as videojs from 'video.js'

interface PlayerProps { options: any }
interface PlayerState { player?: videojs.Player }
export default class Player extends React.Component<PlayerProps, PlayerState> {
  constructor(props: PlayerProps) {
    super(props);
    this.state = {};
  }

  ctrls: {
    videoNode: HTMLVideoElement,
  } = { videoNode: null };

  componentDidMount() {
    this.setState({ player: videojs(this.ctrls.videoNode, this.props.options, function onPlayerReady() { console.log('onPlayerReady', this) }) });
  }

  componentWillUnmount() {
    if (this.state.player) this.state.player.dispose()
  }

  // wrap the player in a div with a `data-vjs-player` attribute
  // so videojs won't create additional wrapper in the DOM
  // see https://github.com/videojs/video.js/pull/3856
  render() {
    return (
      <div data-vjs-player>
        <video ref={node => this.ctrls.videoNode = node} className="video-js"></video>
      </div>
    )
  }
}