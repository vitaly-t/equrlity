"use strict";
const Gen = require("../../dist/gen/fsgen.js");
Gen.writeTypescriptTypesToFile("./src/lib/datatypes.ts");
Gen.writeTableCreateStatementsToFile("./dist/sqlcreates.sql");