import * as React from 'react';
import { Button, Intent, Tooltip, Position, Popover, PopoverInteractionKind, EditableText } from "@blueprintjs/core";
import * as Select from 'react-select';
import { Col } from 'react-simple-flex-grid';

import { Panel, Row, Label, TextAuto } from '../lib/components';
import * as Constants from '../lib/constants';


type Person = string;
type Instrument = string;
type Percentage = number;

type Performer = {
  person: Person;
  instrument: Instrument;
}

type Royalty = {
  performer: Person;
  percent: Percentage;
}

export type TrackInfo = {
  artist: string;
  album?: string;
  releaseDate?: Date;
  composers?: Person[];
  performers?: Performer[];
  royalties?: Royalty[];
}

export function newTrackInfo(): TrackInfo {
  return { artist: '', album: '', releaseDate: new Date(), composers: [], performers: [], royalties: [] };
}

interface TrackInfoViewerProps { trackInfo: TrackInfo }
export class TrackInfoViewer extends React.Component<TrackInfoViewerProps, {}> {

  render() {
    let info = this.props.trackInfo;
    let lspan = 2;
    let rspan = 10;

    return (<div>
      <Row>
        <Label span={lspan}>Artist:</Label>
        <Col span={rspan}>{info.artist}</Col>
      </Row>
      {info.album && <Row>
        <Label span={lspan}>Album:</Label>
        <Col span={rspan}>{info.album}</Col>
      </Row>}
      {info.composers && info.composers.length > 0 && <Row>
        <Label span={lspan}>{"Composer" + (info.composers.length > 1 ? "s" : "")}:</Label>
        <Col span={rspan}>{info.composers.map(c => <p>{c}</p>)}</Col>
      </Row>}
      {info.performers && info.performers.length > 0 && <Row>
        <Label span={lspan}>{"Performer" + (info.performers.length > 1 ? "s" : "")}:</Label>
        <Col span={rspan}>{info.performers.map(p => <p>{p.person + " : " + p.instrument}</p>)}</Col>
      </Row>}
    </div>);
  }

}

interface TrackInfoEditorProps { trackInfo: TrackInfo, lspan: number, rspan?: number, onChange: (info: TrackInfo) => void }
interface TrackInfoEditorState { performers: string, composers: string }
export class TrackInfoEditor extends React.Component<TrackInfoEditorProps, TrackInfoEditorState> {

  constructor(props: TrackInfoEditorProps) {
    super(props);
    let performers = this.stringifyPerformers(props.trackInfo);
    let composers = this.stringifyComposers(props.trackInfo);
    this.state = { performers, composers };
  }

  changeArtist(artist: string) {
    let trackInfo = { ...this.props.trackInfo, artist }
    this.props.onChange(trackInfo);
  }

  changeAlbum(album: string) {
    let trackInfo = { ...this.props.trackInfo, album }
    this.props.onChange(trackInfo);
  }

  changeComposers(s: string) {
    let composers = s.replace(',', '\n').split('\n').map(s => s.trim()).filter(s => s && s.length > 0);
    let trackInfo = { ...this.props.trackInfo, composers }
    this.props.onChange(trackInfo);
    this.setState({ composers: this.stringifyComposers(trackInfo) });
  }

  changePerformers(s: string) {
    let performers = [];
    s.replace(',', '\n').split('\n').forEach(p => {
      let [person, instrument] = p.split(':').map(s => s.trim());
      person = person || "???";
      instrument = instrument || "???";
      performers.push({ person, instrument });
    });
    let trackInfo = { ...this.props.trackInfo, performers }
    this.props.onChange(trackInfo);
    this.setState({ performers: this.stringifyPerformers(trackInfo) });
  }

  stringifyComposers(info) {
    return info.composers.join('\n')
  }

  stringifyPerformers(info) {
    return info.performers.map(p => p.person + " : " + p.instrument).join('\n')
  }

  render() {
    let { btnStyle } = Constants;
    let info = this.props.trackInfo;
    let lspan = this.props.lspan;
    let rspan = this.props.rspan || 12 - lspan;
    let perfTooltip = "Contains a list of name / instrument pairs. Enter each performer on a separate line, in the format <name> : <instrument>.";
    let compTooltip = "Contains a list of names. Enter each composer on a separate line.";

    return (<div>
      <Row>
        <Label span={lspan}>Artist:</Label>
        <Col span={rspan}><EditableText defaultValue={info.artist} onConfirm={v => this.changeArtist(v)} /></Col>
      </Row>
      <Row>
        <Label span={lspan}>Album:</Label>
        <Col span={rspan}><EditableText defaultValue={info.album} onConfirm={v => this.changeAlbum(v)} /></Col>
      </Row>
      <Row>
        <Label span={lspan} tooltip={compTooltip}>Composer(s):</Label>
        <Col span={rspan}><EditableText multiline value={this.state.composers} onChange={v => this.setState({ composers: v })} onConfirm={v => this.changeComposers(v)} /></Col>
      </Row>
      <Row>
        <Label span={lspan} tooltip={perfTooltip}>Performer(s):</Label>
        <Col span={rspan}><EditableText multiline value={this.state.performers} onChange={v => this.setState({ performers: v })} onConfirm={v => this.changePerformers(v)} /></Col>
      </Row>
    </div>);
  }

}

