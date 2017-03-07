
import * as React from 'react';
import { Button, Dialog, Intent } from "@blueprintjs/core";

interface OkBoxProps { message: string; show: boolean, onClose: () => void, title?: string }
export class OkBox extends React.Component<OkBoxProps, {}> {

  public render() {
    if (!this.props.show) return null;
    return (
      <Dialog iconName="inbox" isOpen={this.props.show} title={this.props.title || "Message"} >
        <div className="pt-dialog-body">
          {this.props.message}
        </div>
        <div className="pt-dialog-footer">
          <div className="pt-dialog-footer-actions">
            <Button text="Secondary" />
            <Button
              intent={Intent.PRIMARY}
              onClick={() => this.props.onClose()}
              text="Primary"
            />
          </div>
        </div>
      </Dialog>
    );
  }
}

interface YesNoBoxProps { title?: string, message: string; onYes: () => void, onNo?: () => void, onClose?: (e: React.SyntheticEvent<HTMLElement>) => void };
export class YesNoBox extends React.Component<YesNoBoxProps, {}> {

  public render() {
    let props = this.props;
    return (
      <Dialog iconName="inbox" isOpen={true} onClose={props.onClose || ((e) => { })} title={props.title || "Confirm"} >
        <div className="pt-dialog-body">
          {props.message}
        </div>
        <div className="pt-dialog-footer">
          <div className="pt-dialog-footer-actions">
            <Button intent={Intent.DANGER} onClick={(e) => { props.onYes(); props.onClose(e); }} text="Yes" />
            <Button text="No" onClick={(e) => { if (props.onNo) props.onNo(); else props.onClose(e); }} />
          </div>
        </div>
      </Dialog>
    );
  }
}