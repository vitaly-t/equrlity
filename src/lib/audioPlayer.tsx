import * as React from 'react';

const DEFAULT_LISTEN_INTERVAL = 10000;

export type AudioPlayerProps = {
  src: string;
  type: string;
  autoPlay?: boolean;
  listenInterval?: number;
  listenTracker?: any;
  onAbort?: any;
  onCanPlay?: any;
  onCanPlayThrough?: any;
  onEnded?: any;
  onError?: any;
  onListen?: any;
  onPause?: any;
  onPlay?: any;
  onSeeked?: any;
  preload?: string;
  controls?: boolean;
  style?: Object;
};

export type AudioPlayerState = {
  listenTracker: any;
};

export class AudioPlayer extends React.Component<AudioPlayerProps, AudioPlayerState> {

  constructor(props) {
    super(props);
    this.state = { listenTracker: null };
  }

  ctrls: {
    audioEl?: HTMLAudioElement
  } = {}


  componentDidMount() {
    const audio = this.ctrls.audioEl;

    audio.addEventListener('error', (e) => {
      this.props.onError && this.props.onError(e);
    });

    // When enough of the file has downloaded to start playing
    audio.addEventListener('canplay', (e) => {
      this.props.onCanPlay && this.props.onCanPlay(e);
    });

    // When enough of the file has downloaded to play the entire file
    audio.addEventListener('canplaythrough', (e) => {
      this.props.onCanPlayThrough && this.props.onCanPlayThrough(e);
    });

    // When audio play starts
    audio.addEventListener('play', (e) => {
      this.setListenTrack();
      this.props.onPlay && this.props.onPlay(e);
    });

    // When unloading the audio player (switching to another src)
    audio.addEventListener('abort', (e) => {
      this.clearListenTrack();
      this.props.onAbort && this.props.onAbort(e);
    });

    // When the file has finished playing to the end
    audio.addEventListener('ended', (e) => {
      this.clearListenTrack();
      this.props.onEnded && this.props.onEnded(e);
    });

    // When the user pauses playback
    audio.addEventListener('pause', (e) => {
      this.clearListenTrack();
      this.props.onPause && this.props.onPause(e);
    });

    // When the user drags the time indicator to a new time
    audio.addEventListener('seeked', (e) => {
      this.clearListenTrack();
      this.props.onSeeked && this.props.onSeeked(e);
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.selectedPlayerEvent) {
      const audio = this.ctrls.audioEl;

      audio.currentTime = nextProps.selectedPlayerEvent.playTime;
      audio.play();
    }
  }

  /**
   * Set an interval to call props.onListen every props.listenInterval time period
   */
  setListenTrack() {
    if (!this.state.listenTracker) {
      const listenInterval = this.props.listenInterval || DEFAULT_LISTEN_INTERVAL;
      let listenTracker = setInterval(() => {
        this.props.onListen && this.props.onListen(this.ctrls.audioEl.currentTime);
      }, listenInterval);
      this.setState({ listenTracker });
    }
  }

  /**
   * Clear the onListen interval
   */
  clearListenTrack() {
    if (this.state.listenTracker) {
      clearInterval(this.state.listenTracker);
      this.setState({ listenTracker: null });
    }
  }

  render() {

    // Set controls to be true by default unless explicity stated otherwise
    const controls = !(this.props.controls === false);

    return (
      <audio
        className='react-audio-player'
        style={this.props.style}
        autoPlay={this.props.autoPlay}
        preload={this.props.preload}
        controls={controls}
        ref={(ref) => { this.ctrls.audioEl = ref; }}
        onPlay={this.props.onPlay}
      >
        <source src={this.props.src} type={this.props.type} />
        <p>Your browser does not support the <code>audio </code> element.</p >
      </audio>
    );
  }
}

