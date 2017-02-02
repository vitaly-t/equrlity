"use strict";

const url = process.env.DATABASE_URL;

import * as OxiDate from '../lib/oxidate';

import { IMain, IDatabase } from 'pg-promise';
import * as pgPromise from 'pg-promise';
import * as Dbt from '../lib/datatypes'
import * as OxiGen from '../lib/oxigen';

const pgp: IMain = pgPromise({
    // Initialization Options
});

const db: OxiGen.IDbSchema = OxiGen.dbSchema;

//pgp.pg.types.setTypeParser(1114, str => moment.utc(str).format());

const pg: IDatabase<any> = pgp(url);


describe("OxiGen suite", function () {
  it("should parse an empty schema", () => {
    let json = JSON.parse('{"scalarTypes": {}, "tupleTypes": [], "tables": {} }');
    let db = OxiGen.loadModel(json);
    expect(db.dataTypes.size).toEqual(0);
    expect(db.tables.size).toEqual(0);
  })

  it("should work", () => {
    //console.log("types: "+db.dataTypes.size);
    //console.log("tables: "+db.tables.size);
    expect(db.dataTypes.size).toBeGreaterThan(0);
    expect(db.tables.size).toBeGreaterThan(0);
    let auths = db.tables.get('auths');
    let istr = OxiGen.genInsertStatement(auths);
    expect(istr).toEqual('INSERT INTO auths("authId","userId","created","updated") VALUES (${authId},${userId},${created},${updated})');
    let ostr = OxiGen.genUpdateStatement(auths);
    expect(ostr).toEqual('UPDATE auths SET "userId" = ${userId}, "created" = ${created}, "updated" = ${updated} WHERE "authId" = ${authId}');
    let ustr = OxiGen.genUpsertStatement(auths);
    let ucmp = 'INSERT INTO auths("authId","userId","created","updated") VALUES (${authId},${userId},${created},${updated})'
      + ' on conflict("authId") do '
      + 'UPDATE auths SET "userId" = ${userId}, "created" = ${created}, "updated" = ${updated}';
    expect(ustr).toEqual(ucmp);
    //OxiGen.writeTypescriptTypesToFile(db, "./test/datatypes.tst");
    
    let emptyAuth = {authId: undefined, userId: undefined, created: undefined, updated: undefined};
    let istr2 = OxiGen.genInsertStatement(auths, emptyAuth);
    expect(istr2).toEqual('INSERT INTO auths() VALUES ()');
    expect(() => OxiGen.genUpdateStatement(auths, emptyAuth)).toThrow();

    let tAuth3 = {...emptyAuth, authId: "my auth id", userId: 'gary'};
    let istr3 = OxiGen.genInsertStatement(auths, tAuth3);
    expect(istr3).toEqual('INSERT INTO auths("authId","userId") VALUES (${authId},${userId})');
    let ostr3 = OxiGen.genUpdateStatement(auths, tAuth3);
    expect(ostr3).toEqual('UPDATE auths SET "userId" = ${userId} WHERE "authId" = ${authId}');
    
    let tAuth4 = {...emptyAuth, userId: null};
    let istr4 = OxiGen.genInsertStatement(auths, tAuth4);
    expect(istr4).toEqual('INSERT INTO auths("userId") VALUES (${userId})');
    expect(() => OxiGen.genUpdateStatement(auths, tAuth4)).toThrow();
    
    let blog = db.tables.get('blog');
    let blogistr = OxiGen.genInsertStatement(blog);
    expect(blogistr).toEqual('INSERT INTO blog("published","lastedit","title","body","tags") VALUES (${published},${lastedit},${title},${body},${tags}) RETURNING "id"');
    expect(() => OxiGen.genUpsertStatement(blog)).toThrow();

  })

})