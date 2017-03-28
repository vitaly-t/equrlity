"use strict";

import * as fs from "fs"
import { Url, parse } from 'url';
import { it } from 'jasmine-promise-wrapper';

import * as Dbt from '../lib/datatypes'
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';
Utils.setTest(true);  // Not sure this is kosher ...

import * as pg from '../server/pgsql';
import * as cache from '../server/cache';

async function countLinks(): Promise<number> {
  return await pg.countRecordsInTable("links");
}

it("should work using direct calls", async () => {
  expect(Utils.isDev()).toEqual(true, "not a dev environment");
  await pg.recreateDataTables();
  await pg.init();
  let u1 = await pg.createUser();
  expect(u1.userName).toEqual("anonymous_0", "not the first user");
  expect(u1.credits).toEqual(1000);

  let u2 = await pg.createUser();
  expect(u2.userName).toEqual("anonymous_1", "not the second user");
  let u3 = await pg.createUser();
  expect(u3.userName).toEqual("anonymous_2", "not the third user");

  let u4 = await pg.createUser();
  expect(u4.userName).toEqual("anonymous_3", "not the fourth user");

  let rsp1 = await pg.handlePromoteLink(u1.userId, { publicKey: "", url: "https://www.example.com/anydamnthing", signature: "", linkDescription: "wow awesome link", amount: 10 });
  let ok = rsp1 as Rpc.PromoteLinkResponse;
  expect(ok.link).toBeDefined("promote link call failed");
  expect(cache.users.get(u1.userId).credits).toEqual(990);
  expect(await countLinks()).toEqual(1);

  let url = parse(ok.link);
  let linkId1 = Utils.getLinkIdFromUrl(url);
  let link1 = cache.links.get(linkId1);
  expect(link1).toBeDefined("cache error on link1");

  let rsp2 = await pg.handlePromoteLink(u2.userId, { publicKey: "", url: ok.link, signature: "", linkDescription: "promote me baby", amount: 20 });
  expect(await countLinks()).toEqual(2);
  let rspt = rsp2 as Rpc.PromoteLinkResponse
  expect(rspt.link).toBeDefined("promote call failed");
  expect(cache.users.get(u2.userId).credits).toEqual(980);
  let url2 = parse(rspt.link);
  expect(Utils.isPseudoQLinkURL(url2)).toEqual(true);
  let linkId2 = Utils.getLinkIdFromUrl(url2);
  expect(cache.getChainFromLinkId(linkId2).length).toEqual(2, "link not chained");

  // test social graph updated
  expect(cache.userlinks.get(u1.userId).length).toEqual(1);
  expect(cache.userlinks.get(u1.userId)[0]).toEqual(u2.userId);
  expect(cache.userlinks.get(u2.userId).length).toEqual(1);
  expect(cache.userlinks.get(u2.userId)[0]).toEqual(u1.userId);
  expect(cache.userlinks.has(u3.userId)).toEqual(false);

  {  // new let namespace
    let content = "https://www.example.com/somethingelse";
    let rsp = await pg.handlePromoteLink(u1.userId, { publicKey: "", url: content, signature: "", linkDescription: "yaal", amount: 10 });
    expect(await countLinks()).toEqual(3);

    let ok = rsp as Rpc.PromoteLinkResponse;
    expect(ok.link).toBeDefined("add handlePomoteLink call failed");
    let url = parse(ok.link);
    expect(Utils.isPseudoQURL(url)).toEqual(true);
    expect(Utils.isPseudoQLinkURL(url)).toEqual(true);
    let linkId = Utils.getLinkIdFromUrl(url);
    let prom = await pg.promotionsCount(linkId);
    expect(prom).toEqual(1, "promotions not working");
    let viewed = await pg.hasViewed(u2.userId, linkId);
    expect(viewed).toEqual(false);
    let bal = cache.users.get(u2.userId).credits;
    let linkbal = cache.links.get(linkId).amount;

    // user2 views link
    await pg.payForView(u2.userId, linkId)
    let newbal = cache.users.get(u2.userId).credits;
    expect(newbal).toEqual(bal + 1, "payment for view not recorded");
    expect(cache.links.get(linkId).amount).toEqual(linkbal - 1, "link amount not adjusted for view");

    expect(cache.userlinks.get(u1.userId).length).toEqual(1, "social graph not correct");
    let rsp2 = await pg.handlePromoteLink(u3.userId, { publicKey: "", url: ok.link, signature: "", linkDescription: "yaal2", amount: 10 });
    let ok2 = rsp2 as Rpc.PromoteLinkResponse;
    expect(ok2.link).toBeDefined("Promote call failed");
    expect(cache.userlinks.get(u1.userId).length).toEqual(2, "social graph not extended");
    {
      let url = parse(ok2.link);
      let linkId2 = Utils.getLinkIdFromUrl(url);
      let bal = cache.links.get(linkId).amount;
      expect(cache.getChainFromLinkId(linkId2).length).toEqual(2, "link not chained");

      // user4 views promoted link
      await pg.payForView(u4.userId, linkId2);
      let newbal = cache.links.get(linkId).amount;
      expect(newbal).toEqual(bal + 1, "incorrect payment for chained view");
    }

    // redeem link  testing - particularly re-grafting..
    let rsp3 = await pg.handlePromoteLink(u4.userId, { publicKey: "", url: ok.link, signature: "", linkDescription: "yaal3", amount: 10 });
    let ok3 = rsp3 as Rpc.PromoteLinkResponse;
    expect(ok3.link).toBeDefined("promote call failed");
    {
      let bal = cache.users.get(u1.userId).credits;
      let link = cache.links.get(linkId);
      let linkbal = link.amount;
      await pg.redeemLink(link);
      let newbal = cache.users.get(u1.userId).credits;
      expect(bal + linkbal).toEqual(newbal, "link balance not redeemed");
      let rootLinks = await pg.getRootLinksForUrl(content);
      expect(rootLinks.length).toEqual(2);
    }

  }
});

it("should work for bytea types", async () => {
  // test bytea content stuff
  let u = await pg.createUser();
  let content: Uint8Array = fs.readFileSync("/dev/pseudoqurl/spec/EarlyThisMorning.wav");
  let rsp = await pg.insertContent(content, "wav", "audio", "Early This Morning", u.userId);
  console.log(rsp.contentId);
  let cont2 = await pg.retrieveContent(rsp.contentId)
  let s1 = pg.pgp.as.buffer(content);
  let s2 = pg.pgp.as.buffer(cont2);
  expect(s1).toEqual(s2, "bytea cactus");
}, 60000);
