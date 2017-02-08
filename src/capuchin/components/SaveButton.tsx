import * as React from 'react';

export interface SaveButtonProps { label: string; action: () => void };

export const SaveButton = (props: SaveButtonProps) => {
  return <button onClick={ props.action } >{props.label}</button>
}
