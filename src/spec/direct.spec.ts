"use strict";

import * as fs from "fs"
import * as stream from 'stream';
import { Url, parse, format } from 'url';
import { it } from 'jasmine-promise-wrapper';
import { TextEncoder, TextDecoder } from 'text-encoding';

import * as Dbt from '../lib/datatypes'
import * as Rpc from '../lib/rpc';
import * as Utils from '../lib/utils';

Utils.setTest(true);  // Not sure this is kosher ...

import * as pg from '../server/pgsql';
import * as cache from '../server/cache';

let publicKey: JsonWebKey = { kty: '' };

async function countLinks(): Promise<number> {
  return await pg.countRecordsInTable("links");
}

it("should work using direct calls", async () => {
  expect(Utils.isDev()).toEqual(true, "not a dev environment");
  await pg.recreateDataTables();
  await pg.init();

  let u0 = await pg.createUser();
  console.log("created user 0");
  expect(u0.userName).toEqual("anonymous_0", "not the first user");
  expect(u0.credits).toEqual(1000);

  let u1 = await pg.createUser();
  console.log("created user 1");
  expect(u1.userName).toEqual("anonymous_1", "not the second user");

  let u2 = await pg.createUser();
  console.log("created user 2");
  expect(u2.userName).toEqual("anonymous_2", "not the third user");

  let u3 = await pg.createUser();
  console.log("created user 3");
  expect(u3.userName).toEqual("anonymous_3", "not the fourth user");

  let u4 = await pg.createUser();
  console.log("created user 4");
  expect(u4.userName).toEqual("anonymous_4", "not the fifth user");

  //let pr = await Crypto.generateKeyPair();
  //let publicKey = await Crypto.getPublicKeyJWK(pr);

  let preq1: Rpc.PromoteLinkRequest = { publicKey, comment: "great comment", tags: [], url: "https://www.example.com/anydamnthing", signature: "", title: "wow awesome link", amount: 10 };
  let rsp1 = await pg.handlePromoteLink(u1.userId, preq1);
  let ok = rsp1 as Rpc.PromoteLinkResponse;
  expect(ok.link).toBeDefined("promote link call failed");
  expect(cache.users.get(u1.userId).credits).toEqual(990);
  expect(await countLinks()).toEqual(1);

  let link1 = cache.links.get(ok.link.linkId);
  expect(link1).toBeDefined("cache error on link1");

  let preq2: Rpc.PromoteLinkRequest = { publicKey, comment: "another great comment", tags: [], url: Utils.linkToUrl(ok.link.linkId, ''), signature: "", title: "promote me baby", amount: 10 };
  let rsp2 = await pg.handlePromoteLink(u2.userId, preq2);
  expect(await countLinks()).toEqual(2);
  expect(rsp2.link).toBeDefined("promote call failed");
  expect(cache.users.get(u2.userId).credits).toEqual(990);
  expect(cache.getChainFromLinkId(rsp2.link.linkId).length).toEqual(2, "link not chained");

  // test social graph updated
  expect(cache.userlinks.get(u1.userId).length).toEqual(1);
  expect(cache.userlinks.get(u1.userId)[0]).toEqual(u2.userId);
  expect(cache.userlinks.get(u2.userId).length).toEqual(1);
  expect(cache.userlinks.get(u2.userId)[0]).toEqual(u1.userId);
  expect(cache.userlinks.has(u3.userId)).toEqual(false);

  {  // new let namespace
    let preq3: Rpc.PromoteLinkRequest = { publicKey, comment: "groovy", tags: [], url: "https://www.example.com/somethingelse", signature: "", title: "yaa!!", amount: 10 };
    let rsp = await pg.handlePromoteLink(u1.userId, preq3);
    expect(await countLinks()).toEqual(3);

    let ok = rsp as Rpc.PromoteLinkResponse;
    expect(ok.link).toBeDefined("add handlePomoteLink call failed");
    let url = parse(Utils.linkToUrl(ok.link.linkId, ok.link.title));
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
    let preq4: Rpc.PromoteLinkRequest = { publicKey, comment: "groovy baby", tags: [], url: format(url), signature: "", title: "yaa2  !!", amount: 10 };
    let rsp2 = await pg.handlePromoteLink(u3.userId, preq4);
    let ok2 = rsp2 as Rpc.PromoteLinkResponse;
    expect(ok2.link).toBeDefined("Promote call failed");
    expect(cache.userlinks.get(u1.userId).length).toEqual(2, "social graph not extended");
    {
      let bal = cache.links.get(linkId).amount;
      expect(cache.getChainFromLinkId(ok2.link.linkId).length).toEqual(2, "link not chained");

      // user4 views promoted link
      await pg.payForView(u4.userId, ok2.link.linkId);
      let newbal = cache.links.get(linkId).amount;
      expect(newbal).toEqual(bal + 1, "incorrect payment for chained view");
    }

    // redeem link  testing - particularly re-grafting..
    let preq5: Rpc.PromoteLinkRequest = { publicKey, comment: "groovy baby", tags: [], url: Utils.linkToUrl(ok.link.linkId, ''), signature: "", title: "yaal3!!", amount: 10 };
    let rsp3 = await pg.handlePromoteLink(u4.userId, preq5);
    let ok3 = rsp3 as Rpc.PromoteLinkResponse;
    expect(ok3.link).toBeDefined("promote call failed");

    {
      let bal = cache.users.get(u1.userId).credits;
      let link = cache.links.get(linkId);
      let linkbal = link.amount;
      await pg.redeemLink(link);
      let newbal = cache.users.get(u1.userId).credits;
      expect(bal + linkbal).toEqual(newbal, "link balance not redeemed");
      let links = await pg.getLinksForUrl(link.url);
      let rootLinks = links.filter(l => !l.prevLink);
      expect(rootLinks.length).toEqual(2);
    }

  }
});

it("should work for blobs", async () => {
  let u = await pg.createUser();
  let strm = fs.createReadStream("/dev/pseudoqurl/spec/EarlyThisMorning.wav");
  let rsp = await pg.insertBlobContent(strm, "testing", "wav", "audio", "Early This Morning", u.userId);
  console.log(rsp.contentId);
  let cont2 = await pg.retrieveBlobContent(rsp.contentId)
  let content = fs.readFileSync("/dev/pseudoqurl/spec/EarlyThisMorning.wav");
  let s1 = pg.pgp.as.buffer(content);
  let s2 = pg.pgp.as.buffer(cont2);
  expect(s1).toEqual(s2, "blob cactus");
}, 20000);
