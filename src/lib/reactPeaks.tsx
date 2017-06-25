import * as React from 'react';
import * as Peaks from 'peaks.js';
import { PlayBackControls } from './playerControls';

export interface PeaksPlayerProps { src: string, type: string, streamToOwnCost: number };
export interface PeaksPlayerState { pos: number, isReady: boolean };
export class PeaksPlayer extends React.Component<PeaksPlayerProps, PeaksPlayerState> {
  constructor(props: PeaksPlayerProps) {
    super(props);

    this.state = { isReady: false, pos: 0 };
  }

  peaksEl: HTMLDivElement = null;
  audioEl: HTMLAudioElement = null;
  peaks: any = null;

  componentDidMount() {

    let ac = new AudioContext();

    let p = Peaks.init({
      container: this.peaksEl,
      mediaElement: this.audioEl,
      height: 100,
      // zoomLevels: [512, 1024, 2048, 4096],
      zoomLevels: [2048],
      audioContext: ac
    });

    this.peaks = p;
    this.forceUpdate();

    p.on('segments.ready', function () {
      // do something when segments are ready to be displayed
    });
  }

  componentWillUnmount() {
    this.peaks.destroy();
  }

  render() {
    let cont = this.props.streamToOwnCost === 0 ? <p>This stream is free to play.</p>
      : this.props.streamToOwnCost > 0 ? <p>Playing this stream will cost you {this.props.streamToOwnCost} PseudoQoins.</p>
        : <p>If you playing this stream you will be credited with  {this.props.streamToOwnCost} PseudoQoins.</p>
    let audio = this.audioEl;
    let isPlaying = () => !audio.ended && !audio.paused;
    return (
      <div style={{ width: '100%', height: '280px' }} >
        <div style={{ width: '100%', height: '210px', marginRight: '10px' }} ref={c => this.peaksEl = c} />
        <audio id="audioSource" controls={false} preload="auto" ref={c => { this.audioEl = c; }} src={this.props.src} type={this.props.type} />
        {audio && <PlayBackControls
          height={40}
          isPlaying={isPlaying()}
          isMuted={audio.muted}
          volume={audio.volume * 100}
          onVolumeChange={(v) => { audio.volume = v / 100 }}
          showPrevious={false}
          hasPrevious={false}
          showNext={false}
          hasNext={false}
          onTogglePause={() => { if (isPlaying()) audio.pause(); else audio.play(); this.forceUpdate(); }}
          onToggleMute={() => { audio.muted = !audio.muted, this.forceUpdate(); }}
        />}
        {cont}
      </div>

    );
  }
}

