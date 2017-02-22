"use strict";

const url = process.env.DATABASE_URL;
import * as pg from '../server/pgsql';
import * as Dbt from '../lib/datatypes'
import { Url, parse } from 'url';
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
import { it } from 'jasmine-promise-wrapper';

const cache = pg.DbCache;

const unit = () =>
  new Promise(resolve =>
    setTimeout(() => resolve("success"), 1000));

it("should work", async () => {
  expect(Utils.isDev()).toEqual(true, "not a dev environment");
  await pg.recreateDataTables();
  cache.init();
  let u1 = await pg.createUser();
  expect(u1.userName).toEqual("anonymous_0", "not the first user");
  let u2 = await pg.createUser();
  expect(u2.userName).toEqual("anonymous_1", "not the second user");
  let u3 = await pg.createUser();
  expect(u3.userName).toEqual("anonymous_2", "not the third user");
});
