import * as React from 'react';
import * as videojs from 'video.js'

interface PlayerProps { src: string, poster?: string, mime: string }
interface PlayerState { player?: videojs.Player }

export class VideoPlayer extends React.Component<PlayerProps, PlayerState> {
  constructor(props: PlayerProps) {
    super(props);
    this.state = {};
  }

  ctrls: {
    videoNode: HTMLVideoElement,
  } = { videoNode: null };

  componentDidMount() {
    const opts: any = {
      autoplay: false,
      controls: true,
      poster: this.props.poster,
      sources: [{
        src: this.props.src,
        type: this.props.mime
      }]
    }
    this.setState({ player: videojs(this.ctrls.videoNode, opts, function onPlayerReady() { console.log('onPlayerReady', this) }) });
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

export class AudioPlayer extends React.Component<PlayerProps, PlayerState> {
  constructor(props: PlayerProps) {
    super(props);
    this.state = {};
  }

  ctrls: {
    audioNode: HTMLAudioElement,
  } = { audioNode: null };

  componentDidMount() {
    const opts: any = {
      autoplay: false,
      controls: true,
      poster: this.props.poster,
      sources: [{
        src: this.props.src,
        type: this.props.mime
      }]
    }
    this.setState({ player: videojs(this.ctrls.audioNode, opts, function onPlayerReady() { console.log('onPlayerReady', this) }) });
    /*
        const opts: any = {
          autoplay: false,
          controls: true,
          poster: this.props.poster,
        }
        let player = videojs(this.ctrls.audioNode, opts, function onPlayerReady() { console.log('onPlayerReady', this) })
        wavesurfer.register(player, {
          src: this.props.src,
          msDisplayMax: 10,
          debug: false,
          waveColor: 'grey',
          progressColor: 'black',
          cursorColor: 'black',
          hideScrollbar: false,
          //backend: 'MediaElement'
        });
        this.setState({ player });
        */
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
        <video ref={node => this.ctrls.audioNode = node} className="video-js vjs-default-skin"></video>
      </div>
    )
  }
}