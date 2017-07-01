import * as React from 'react';
import { Slider } from "@blueprintjs/core";
import styled from 'styled-components';
import { Row, Col } from 'react-simple-flex-grid';

let enabledClr = '#72D687';
let hoverClr = '#3ea454';


interface SvgWrapperProps { disabled: boolean }
const SvgWrapper: React.StatelessComponent<SvgWrapperProps> = props => (
  <svg {...props} >
    {props.children}
  </svg>
);


let SvgIcon = styled(SvgWrapper) `
  height: 100%;
  width: 100%;
  
  padding: 8px;
  border: 2px solid ${enabledClr};
  fill: ${enabledClr};
  border-radius: 100%;
  outline: none;

  &:hover {
    border: 2px solid ${props => props.disabled ? enabledClr : hoverClr};
    fill: ${props => props.disabled ? enabledClr : hoverClr};
  }

  opacity: ${(props: any) => props.disabled ? 0.3 : 1};
  
`;

export type IconName = "play" | "pause" | "next" | "previous" | "soundoff" | "soundon";

interface ControlProps { icon: IconName, disabled: boolean }

class Control extends React.Component<ControlProps, {}> {
  renderGraphic() {
    switch (this.props.icon) {
      case 'play':
        return (
          <g stroke="none" strokeWidth="1" fillRule="evenodd">
            <polygon points="24,92 24,7 100,50" />
          </g>
        );
      case 'pause':
        return (
          <g stroke="none" strokeWidth="1" fillRule="evenodd">
            <rect id="Rectangle-path" x="58" y="11" width="21" height="78"></rect>
            <rect id="Rectangle-path" x="22" y="11" width="21" height="78"></rect>
          </g>
        );
      case 'next':
        return (
          <g stroke="none" strokeWidth="1" fillRule="evenodd">
            <polygon points="72.6470588 11 72.6470588 44.1141176 15 12.0911765 15 85.9988235 72.6470588 53.9717647 72.6470588 89.2352941 85 89.2352941 85 11"></polygon>
          </g>
        );
      case 'previous':
        return (
          <g stroke="none" strokeWidth="1" fillRule="evenodd">
            <polygon points="85 12.6092632 27.3529412 44.5358947 27.3529412 11 15 11 15 89 27.3529412 89 27.3529412 54.368 85 86.3028421"></polygon>
          </g>
        );
      case 'soundoff':
        return (
          <g stroke="none" strokeWidth="1" fillRule="evenodd">
            <path d="M28.0748663,36.3636364 L0,36.3636364 L0,65.9090909 L30.4812834,65.9090909 L54.5454545,88.6363636 L54.5454545,11.3636364 L28.0748663,36.3636364 Z" id="Combined-Shape-Copy-2"></path>
            <polygon id="Line" points="69.513151 44.1232126 87.6949692 62.3050308 90.9090909 65.5191526 97.3373344 59.0909091 94.1232126 55.8767874 75.9413945 37.6949692 72.7272727 34.4808474 66.2990293 40.9090909"></polygon>
            <polygon id="Line" points="75.9413945 62.3050308 94.1232126 44.1232126 97.3373344 40.9090909 90.9090909 34.4808474 87.6949692 37.6949692 69.513151 55.8767874 66.2990293 59.0909091 72.7272727 65.5191526"></polygon>
          </g>
        );
      case 'soundon':
        return (
          <g stroke="none" strokeWidth="1" fillRule="evenodd">
            <path d="M28.0748663,36.3636364 L0,36.3636364 L0,65.9090909 L30.4812834,65.9090909 L54.5454545,88.6363636 L54.5454545,11.3636364 L28.0748663,36.3636364 Z" id="Combined-Shape-Copy"></path>
            <path d="M84.6032335,82.4592965 C94.5340754,74.7600841 100.468182,62.9599381 100.468182,50.1791986 C100.468182,38.1777252 95.2347685,27.0146095 86.3177905,19.2913999 L80.3660059,26.1631456 C87.313543,32.1805749 91.3772727,40.8487007 91.3772727,50.1791986 C91.3772727,60.1143215 86.7696647,69.2766862 79.0331302,75.2746895 L84.6032335,82.4592965 L84.6032335,82.4592965 Z" id="Shape-Copy"></path>
            <path d="M68.6941426,71.5946428 C75.48494,66.3298533 79.5454545,58.2554001 79.5454545,49.5119787 C79.5454545,41.3018627 75.9644339,33.663378 69.8670756,28.382309 L63.9152911,35.2540546 C68.0432084,38.8293434 70.4545455,43.9728382 70.4545455,49.5119787 C70.4545455,55.4097835 67.7205293,60.8464555 63.1240393,64.4100358 L68.6941426,71.5946428 L68.6941426,71.5946428 Z" id="Shape-Copy-2"></path>
          </g>
        );
    }
  }
  render() {
    return <SvgIcon viewBox="0 0 100 100" disabled={this.props.disabled} preserveAspectRatio="xMidYMid meet">
      {this.renderGraphic()}
    </SvgIcon>
  }
};

interface ButtonProps { disabled: boolean, size: number | string, onClick: () => void }
let divStyle = (props: ButtonProps) => {
  return { display: 'inline-block', width: props.size, height: props.size, marginRight: "10px" };
}

export class PlayButton extends React.Component<ButtonProps, {}> {
  render() {
    return <div style={divStyle(this.props)} onClick={this.props.onClick}>
      <Control icon='play' disabled={this.props.disabled} />
    </div>;
  }
}

export class PauseButton extends React.Component<ButtonProps, {}> {
  render() {
    return <div style={divStyle(this.props)} onClick={this.props.onClick}>
      <Control icon='pause' disabled={this.props.disabled} />
    </div>;
  }
}

export class NextButton extends React.Component<ButtonProps, {}> {
  render() {
    return <div style={divStyle(this.props)} onClick={this.props.onClick}>
      <Control icon='next' disabled={this.props.disabled} />
    </div>;
  }
}

export class PreviousButton extends React.Component<ButtonProps, {}> {
  render() {
    return <div style={divStyle(this.props)} onClick={this.props.onClick}>
      <Control icon='previous' disabled={this.props.disabled} />
    </div>;
  }
}

export class SoundOffButton extends React.Component<ButtonProps, {}> {
  render() {
    return <div style={divStyle(this.props)} onClick={this.props.onClick}>
      <Control icon='soundoff' disabled={this.props.disabled} />
    </div>;
  }
}

export class SoundOnButton extends React.Component<ButtonProps, {}> {
  render() {
    return <div style={divStyle(this.props)} onClick={this.props.onClick}>
      <Control icon='soundon' disabled={this.props.disabled} />
    </div>;
  }
}

const SliderDiv = styled.div`
  box-sizing: border-box;
  display: block;
  position: relative;
  width: 100%;
  height: 20px;
`;

const SliderBarDiv = styled.div`
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 100%;
  margin: 5px;
  height: 10px;
  background: ${enabledClr};
  background-origin: padding-box;
  border-radius: 5px;
`;

const SliderButtonDiv = styled.div`
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 20px;
  height: 20px;
  padding: 0px;
  background: ${enabledClr};
  border-radius: 100%;
`;


interface SliderBarProps { min: number, max: number, value: number, onChange: (v: number) => void }
interface SliderBarState { isDragging: boolean, value: number }
class SliderBar extends React.Component<SliderBarProps, SliderBarState> {
  constructor(props) {
    super(props);
    this.state = { isDragging: false, value: props.value }
  }

  containerEl: HTMLDivElement = null;

  handleMouseDown(e) {
    this.setState({ isDragging: true });
    e.stopPropagation();
    e.preventDefault;
  }

  handleMouseUp(e) {
    this.setState({ isDragging: false });
    e.stopPropagation();
    e.preventDefault;
  }

  handleMouseMove(e) {
    const { onChange, min, max } = this.props;
    if (this.state.isDragging) {
      const { left, right } = this.containerEl.getBoundingClientRect();
      const rLeft = left - document.body.getBoundingClientRect().left;

      let value = ((e.clientX - rLeft) / (right - rLeft)) * 100;
      if (value < min) value = min;
      if (value > max) value = max;

      this.setState({ value });
      if (onChange) onChange(value);
    }
    e.stopPropagation();
    e.preventDefault;
  }

  render() {
    const { min, max } = this.props;
    const { isDragging } = this.state;
    let { value } = this.state;
    if (typeof value === 'undefined') value = min;

    return (
      <SliderDiv
        innerRef={c => { this.containerEl = c; }}
        onMouseUp={e => this.handleMouseUp(e)}
        onMouseDown={e => this.handleMouseDown(e)}
        onMouseMove={e => this.handleMouseMove(e)}
      >
        <SliderBarDiv />
        <SliderButtonDiv style={{ left: value.toString() + "%" }} />
      </SliderDiv>
    );
  }
}

export interface VolumeSliderProps { volume: number, onChange: (volume: number) => void };
export class VolumeSlider extends React.Component<VolumeSliderProps, {}> {
  render() {
    return <SliderBar
      min={0}
      max={100}
      onChange={this.props.onChange}
      value={this.props.volume}
    />
  }
}

export interface PlayBackControlsProps {
  height: number, isPlaying: boolean, isMuted: boolean, volume: number, onVolumeChange: (v: number) => void,
  showPrevious: boolean, hasPrevious: boolean, onPrevious?: () => void,
  showNext: boolean, hasNext: boolean, onNext?: () => void,
  onTogglePause: () => void, onToggleMute: () => void
}
export class PlayBackControls extends React.Component<PlayBackControlsProps, {}> {
  render() {
    let btnSize = this.props.height;
    let { height, isPlaying, isMuted, showPrevious, hasPrevious, onPrevious, showNext, hasNext, onNext, onTogglePause, onToggleMute, volume, onVolumeChange } = this.props
    return <Row align="middle" >
      <Col>
        {showPrevious && <PreviousButton size={btnSize} disabled={!hasPrevious} onClick={onPrevious} />}
        {!isPlaying && <PlayButton size={btnSize} disabled={false} onClick={onTogglePause} />}
        {isPlaying && <PauseButton size={btnSize} disabled={false} onClick={onTogglePause} />}
        {showNext && <NextButton size={btnSize} disabled={!hasNext} onClick={onNext} />}
        {!isMuted && <SoundOffButton size={btnSize} disabled={false} onClick={onToggleMute} />}
        {isMuted && <SoundOnButton size={btnSize} disabled={false} onClick={onToggleMute} />}
      </Col>
    </Row>
  }

}

/*  maybe later
      <Col style={{ width: "100px" }} >
        <VolumeSlider volume={volume} onChange={onVolumeChange} />
      </Col>
*/
