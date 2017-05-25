import * as React from 'react';
import * as _Surfer from 'wavesurfer.js';

export interface WavesurferProps { options: any, playing?: boolean, pos: number, volume?: number, mediaElt: string, audioFile: string };
export interface WavesurferState { pos: number, isReady: boolean };
export class Wavesurfer extends React.Component<WavesurferProps, WavesurferState> {
  constructor(props: WavesurferProps) {
    super(props);

    this.state = { isReady: false, pos: 0 };
  }

  wavesurferEl: HTMLDivElement = null;
  wavesurfer: any = null;

  componentDidMount() {
    const options = { ...this.props.options, container: this.wavesurferEl, backend: 'MediaElement' };
    this.wavesurfer = Object.create(_Surfer);
    let ws = this.wavesurfer;
    ws.init(options);

    // file was loaded, wave was drawn
    ws.on('ready', () => {
      let pos = this.props.pos
      this.setState({
        isReady: true,
        pos
      });

      if (pos) ws._seekTo(pos);

      if (this.props.volume != null) ws.setVolume(this.props.volume);

      if (this.props.playing) ws.play()

    });

    ws.load(window.document.querySelector(this.props.mediaElt));

  }

  shouldComponentUpdate() {
    return false;
  }

  componentWillUnmount() {
    this.wavesurfer.destroy();
  }

  // receives seconds and transforms this to the position as a float 0-1
  secToPos(sec) {
    return (1 / this.wavesurfer.getDuration()) * sec;
  }

  // receives position as a float 0-1 and transforms this to seconds
  posToSec(pos) {
    return pos * this.wavesurfer.getDuration();
  }

  // pos is in seconds, the 0-1 proportional position we calculate here …
  seekToSec(sec) {
    const pos = this.secToPos(sec);
    this.wavesurfer.seekTo(pos);
  }

  seekTo(pos) {
    this.wavesurfer.seekTo(pos);
  }

  render() {
    return (
      <div ref={c => this.wavesurferEl = c} />
    );
  }
}

