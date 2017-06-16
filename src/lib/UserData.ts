import { Url, format, parse } from 'url';
import * as Rpc from '../lib/rpc';
import * as Dbt from '../lib/datatypes';
import * as Utils from '../lib/utils';
import { TagSelectOption } from '../lib/tags';


export interface UserData {
  user: Dbt.User;
  following: Dbt.UserFollow[];
  contents: Dbt.Content[];
  //auths: Dbt.Auth[];
  squawks: Dbt.Link[];
  feeds: Dbt.Feed[];
  promotions: Dbt.Promotion[];
}


