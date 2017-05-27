import * as React from 'react';
import * as Peaks from 'peaks.js';

export interface PeaksPlayerProps { src: string, type: string };
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
      audioContext: ac
    });

    this.peaks = p;

    p.on('segments.ready', function () {
      // do something when segments are ready to be displayed
    });
  }

  shouldComponentUpdate() {
    return false;
  }

  componentWillUnmount() {
    this.peaks.destroy();
  }

  render() {
    return (
      <div style={{ width: '100%', height: '250px' }} >
        <div style={{ width: '100%', height: '210px', marginRight: '10px' }} ref={c => this.peaksEl = c} />
        <audio id="audioSource" controls preload="auto" ref={c => { this.audioEl = c; }} src={this.props.src} type={this.props.type} >
          <source src={this.props.src} type={this.props.type} />
        </audio>
      </div>

    );
  }
}

