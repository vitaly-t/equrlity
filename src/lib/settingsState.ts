import {Link} from './datatypes';

export interface SettingsState {
  nickName: string;
  user_balance: number;
  email: string;
  links: Link[];
}