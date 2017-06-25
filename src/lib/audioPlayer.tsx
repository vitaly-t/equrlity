import * as React from 'react';
//import { PlaybackControls, PlayButton, PauseButton, ProgressBar, TimeMarker, MuteToggleButton, VolumeSlider } from 'react-player-controls'
import { PlayBackControls } from './playerControls';

const noop = () => { };
/*
export interface ControlsProps { hasPrevious: boolean, onPrevious: () => void, hasNext: boolean, onNext: () => void, onStop: () => void, onStart: () => void };
class Controls extends React.Component<ControlsProps, {}> {
  render() {
    let { hasPrevious, onPrevious, hasNext, onNext, onStart, onStop } = this.props;
    return <PlaybackControls
      isPlaying={false}
      onStart={noop}
      onStop={noop}
      showPrevious={true}
      hasPrevious={hasPrevious}
      onPrevious={onPrevious}
      showNext={true}
      hasNext={hasNext}
      onNext={onNext}
    />
  }
}
*/
const DEFAULT_LISTEN_INTERVAL = 10000;
const barHeight = 200;

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
  streamToOwnCost?: number;
};

interface BarProps { w: number, h: number };
class Bar extends React.Component<BarProps, {}> {
  render() {
    let h = this.props.h;
    return <div style={{ display: 'inline-block', width: this.props.w.toString() + "px", height: barHeight.toString() + "px", backgroundColor: 'red' }} >
      <div style={{ height: (barHeight - h).toString() + "px", backgroundColor: 'white' }} />
    </div>
  }
}

export interface AudioPlayerState { listenTracker: any, interval: number, bars: Bar[] };
export class AudioPlayer extends React.Component<AudioPlayerProps, AudioPlayerState> {

  constructor(props) {
    super(props);
    this.state = { listenTracker: null, interval: 0, bars: [] };
  }

  peaksEl: HTMLDivElement = null;
  audioEl: HTMLAudioElement = null;

  componentDidMount() {
    const audio = this.audioEl;
    let context = new AudioContext();
    let source = context.createMediaElementSource(audio);
    source.connect(context.destination);
    let analyser = context.createAnalyser();
    source.connect(analyser);
    analyser.connect(context.destination);

    analyser.fftSize = 128; // 2048 by default
    console.log(analyser.frequencyBinCount); // fftSize/2 data points

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
      startVisualization();
      this.props.onPlay && this.props.onPlay(e);
    });

    const startVisualization = () => {
      let frequencyData = new Uint8Array(analyser.frequencyBinCount);
      let w = this.peaksEl.clientWidth / (analyser.frequencyBinCount + 1);
      let h = barHeight / 256; //this.peaksEl.clientHeight / 256;

      let update;
      let maxd = 0
      update = () => {
        analyser.getByteFrequencyData(frequencyData);
        //analyser.getByteTimeDomainData(frequencyData);
        let bars = [];
        for (let i = 0; i < analyser.frequencyBinCount; i++) {
          bars.push(<Bar key={i} w={w} h={frequencyData[i] * h} />)
        }
        this.setState({ interval: requestAnimationFrame(update), bars });
      };

      update();
    }

    // When unloading the audio player (switching to another src)
    audio.addEventListener('abort', (e) => {
      this.clearListenTrack();
      cancelAnimationFrame(this.state.interval);
      this.props.onAbort && this.props.onAbort(e);
    });

    // When the file has finished playing to the end
    audio.addEventListener('ended', (e) => {
      this.clearListenTrack();
      cancelAnimationFrame(this.state.interval);
      this.props.onEnded && this.props.onEnded(e);
    });

    // When the user pauses playback
    audio.addEventListener('pause', (e) => {
      this.clearListenTrack();
      cancelAnimationFrame(this.state.interval);
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
      const audio = this.audioEl;
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
        this.props.onListen && this.props.onListen(this.audioEl.currentTime);
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
    //const controls = !(this.props.controls === false);
    let cont = this.state.bars.length > 0 ? this.state.bars
      : this.props.streamToOwnCost === 0 ? <p>This stream is free to play.</p>
        : this.props.streamToOwnCost > 0 ? <p>Playing this stream will cost you {this.props.streamToOwnCost} PseudoQoins.</p>
          : <p>If you playing this stream you will be credited with  {this.props.streamToOwnCost} PseudoQoins.</p>

    let btnSize = "40px";
    const audio = this.audioEl;
    let isPlaying = audio && !(audio.ended || audio.paused)
    return (
      <div style={{ width: '100%', height: (barHeight + 200).toString() + 'px' }} >
        <div style={{ width: '100%', height: (barHeight + 10).toString() + 'px', marginRight: '10px' }} ref={c => this.peaksEl = c} >
          {cont}
        </div>
        <audio
          className='react-audio-player'
          style={this.props.style}
          autoPlay={this.props.autoPlay}
          preload={this.props.preload}
          controls={false}
          ref={ref => { this.audioEl = ref; }}
          onPlay={this.props.onPlay}
        >
          <source src={this.props.src} type={this.props.type} />
        </audio>
        {audio && <PlayBackControls
          height={40}
          isPlaying={isPlaying}
          isMuted={audio.muted}
          volume={audio.volume}
          onVolumeChange={v => { }}
          showPrevious={true}
          hasPrevious={false}
          showNext={true}
          hasNext={false}
          onTogglePause={() => { if (isPlaying) audio.pause(); else audio.play(); }}
          onToggleMute={() => { audio.muted = !audio.muted }}
        />}
      </div>
    );
  }
}

