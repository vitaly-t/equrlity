import * as React from 'react';
import * as Flex from 'react-simple-flex-grid';
import { EditableText, Tooltip, Position } from '@blueprintjs/core';

import * as Constants from '../lib/constants';

export const Panel: React.StatelessComponent<{}> = ({ children }) => (
  <div className="pt-elevation-0" style={{ width: "100%", height: "100%", backgroundColor: Constants.panelBackgroundColor }}>
    <div style={{ margin: "3px" }}>
      {children}
    </div>
  </div>
)

export interface RowProps { style?: any, gutter?: number, justify?: string, align?: string }
export const Row: React.StatelessComponent<RowProps> = props => {
  let { children, style, gutter, justify, align } = props;
  gutter = gutter || Constants.gutter;
  justify = justify || "start";
  align = align || "top";
  style = style ? { ...Constants.rowStyle, ...style } : Constants.rowStyle;
  return <Flex.Row style={style} gutter={gutter} align={align} justify={justify} >
    {children}
  </Flex.Row>
}

export interface LabelProps { span: number, tooltip?: string }
export const Label: React.StatelessComponent<LabelProps> = props => {
  let { children, span, tooltip } = props;
  let lbl = <span className="pt-text-muted" >{children}</span>;
  if (tooltip) {
    return <Flex.Col span={span}>
      <Tooltip
        className="pt-tooltip-indicator"
        content={<span>{tooltip}</span>}
        position={Position.RIGHT}
      >{lbl}</Tooltip>
    </Flex.Col>;
  }
  return <Flex.Col span={span}>{lbl}</Flex.Col>;

}

export interface TextAutoProps { value: string, disabled?: boolean, onChange?: (v: string) => void }
export const TextAuto: React.StatelessComponent<TextAutoProps> = props => {
  let { value, onChange, disabled } = props;
  disabled = disabled || false;
  onChange = onChange || (v => { return; })
  return <EditableText multiline disabled={disabled} value={value} onChange={onChange} />
}
