import * as React from 'react';
import * as Peaks from 'peaks.js';

import * as Utils from '../lib/utils';
import * as Dbt from '../lib/datatypes';

import { PlayBackControls } from './playerControls';
import { StreamToOwn } from './streamToOwn';

export interface PeaksPlayerProps {
  src: string, type: string, paymentSchedule: number[], streamNumber: number, purchaseCost: number,
  linkDepth: Dbt.integer, peaksUri: Dbt.urlString, onFirstPlay: () => void, onPurchase: () => void
};
export interface PeaksPlayerState { pos: number, isReady: boolean, hasPlayed: boolean };
export class PeaksPlayer extends React.Component<PeaksPlayerProps, PeaksPlayerState> {
  constructor(props: PeaksPlayerProps) {
    super(props);
    this.state = { isReady: false, pos: 0, hasPlayed: false };
  }

  peaksEl: HTMLDivElement = null;
  audioEl: HTMLAudioElement = null;
  peaks: any = null;

  componentDidMount() {

    let cfg: any = {
      container: this.peaksEl,
      mediaElement: this.audioEl,
      height: 100,
      // zoomLevels: [512, 1024, 2048, 4096],
      zoomLevels: [2048],
    };

    if (this.props.peaksUri) cfg.dataUri = { json: this.props.peaksUri };
    else cfg.audioContext = new AudioContext();

    let p = Peaks.init(cfg);

    this.peaks = p;
    this.forceUpdate();

    p.on('segments.ready', function () {
      // do something when segments are ready to be displayed
    });

    this.audioEl.addEventListener('canplay', (e) => {
      this.setState({ isReady: true });
    });
  }

  componentWillUnmount() {
    this.peaks.destroy();
  }

  onPlay() {
    //this.audioEl.play();  // same diff..
    this.peaks.player.play();
    if (!this.state.hasPlayed) {
      if (this.props.onFirstPlay) this.props.onFirstPlay();
      this.setState({ hasPlayed: true });
    }
    else this.forceUpdate();
  }

  render() {
    let { paymentSchedule, streamNumber, purchaseCost, linkDepth } = this.props;
    let audio = this.audioEl;
    let isPlaying = () => !audio.ended && !audio.paused;
    return (
      <div style={{ width: '100%' }} >
        <div style={{ width: '100%', height: '210px', marginRight: '10px' }} ref={c => this.peaksEl = c} />
        <audio id="audioSource" controls={false} preload="auto" ref={c => { this.audioEl = c; }} src={this.props.src} type={this.props.type} />
        {!this.state.isReady ? <h2 style={{ height: "40px", color: "#48AFF0" }}><b><i>... loading ...</i></b></h2>
          : <PlayBackControls
            height={40}
            isPlaying={isPlaying()}
            isMuted={audio.muted}
            volume={audio.volume * 100}
            onVolumeChange={(v) => { audio.volume = v / 100 }}
            showPrevious={true}
            onPrevious={() => this.peaks.player.seekBySeconds(0)}
            hasPrevious={false}
            showNext={false}
            hasNext={false}
            onPlay={() => this.onPlay()}
            onPause={() => { this.peaks.player.pause(); this.forceUpdate(); }}
            onToggleMute={() => { audio.muted = !audio.muted, this.forceUpdate(); }}
          />}
        {!this.state.hasPlayed && <StreamToOwn paymentSchedule={paymentSchedule} streamNumber={streamNumber} purchaseCost={purchaseCost} linkDepth={linkDepth} onPurchase={this.props.onPurchase} />}
      </div>

    );
  }
}

