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
  expect(u1.ampCredits).toEqual(1000);

  let u2 = await pg.createUser();
  expect(u2.userName).toEqual("anonymous_1", "not the second user");
  let u3 = await pg.createUser();
  expect(u3.userName).toEqual("anonymous_2", "not the third user");

  let rsp1 = await pg.handleAddContent(u1.userId, {publicKey: "", content: "https://www.example.com/anydamnthing", signature: "", linkDescription: "wow awesome link", amount: 10});
  let ok = rsp1 as Rpc.AddContentOk;
  expect(ok.link).toBeDefined("add content call failed");
  expect(cache.users.get(u1.userId).ampCredits).toEqual(990);

  let url = parse(ok.link);
  let linkId1 = cache.getLinkIdFromUrl(url);
  let link1 = cache.links.get(linkId1);
  expect(link1).toBeDefined("cache error on link1");

  let rsp2 = await pg.handleAmplify(u2.userId, {publicKey: "", content: ok.link, signature: "", linkDescription: "amplify me baby", amount: 20});
  expect(rsp2.link).toBeDefined("amplify call failed");
  expect(cache.users.get(u2.userId).ampCredits).toEqual(980);



});
