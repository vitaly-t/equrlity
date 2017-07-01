import * as React from 'react';
import * as Peaks from 'peaks.js';
import { PlayBackControls } from './playerControls';
import { StreamToOwn } from './streamToOwn';

export interface PeaksPlayerProps { src: string, type: string, paymentSchedule, streamNumber };
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

  purchaseCost() {
    let { paymentSchedule, streamNumber } = this.props;
    let purchaseCost = 0;
    if (streamNumber > 0) {
      let i = streamNumber - 1;
      while (i < paymentSchedule.length) {
        purchaseCost += paymentSchedule[i];
        ++i;
      }
    }
    return purchaseCost;
  }

  purchaseContent() {

  }

  render() {
    let { paymentSchedule, streamNumber } = this.props;
    let purchaseCost = this.purchaseCost();
    let audio = this.audioEl;
    let isPlaying = () => !audio.ended && !audio.paused;
    return (
      <div style={{ width: '100%' }} >
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
        {false && <StreamToOwn paymentSchedule={paymentSchedule} streamNumber={streamNumber} purchaseCost={purchaseCost} onPurchase={() => this.purchaseContent()} />}
      </div>

    );
  }
}

