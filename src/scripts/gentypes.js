"use strict";
const OxiGen = require("../../dist/lib/oxigen.js");
let db = OxiGen.dbSchema;
OxiGen.writeTypescriptTypesToFile(db, "./src/lib/datatypes.ts");
OxiGen.writeTableCreateStatementsToFile(db, "./dist/sqlcreates.sql");