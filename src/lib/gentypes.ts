import * as OxiGen from './oxigen';
let db = OxiGen.dbSchema;
OxiGen.writeTypescriptTypesToFile(db, "./src/lib/datatypes.ts");
OxiGen.writeTableCreateStatementsToFile(db, "./dist/sqlcreates.sql");
