import * as fs from "fs";
import * as OxiGen from './oxigen';

export function writeTypescriptTypesToFile(fname: string): void {
  let db = OxiGen.dbSchema;
  let strm = fs.createWriteStream(fname, { flags: 'w', encoding: 'utf8' });
  strm.write("// This file is generated - it should not be edited\n\n");
  strm.on('finish', () => strm.close());
  db.dataTypes.forEach(t => {
    let typ = t.enum ? t.enum.map(s => '"' + s + '"').join(" | ")
      : (t.tsType || "string")
    if (t.name !== typ) strm.write("\nexport type " + t.name + " = " + typ + (t.multiValued ? "[]" : "") + ";");
  })
  strm.write("\n\n");

  db.tables.forEach(t => {
    console.log("generating: " + t.name);
    let ts = OxiGen.genTypescriptType(t);
    strm.write(ts + "\n\n");
  })
  strm.end("// end of generated types");
}

export function writeTableCreateStatementsToFile(fname: string): void {
  let db = OxiGen.dbSchema;
  let strm = fs.createWriteStream(fname, { flags: 'w', encoding: 'utf8' });
  strm.write("-- This file is generated - it (probably) should not be edited\n\n");
  strm.on('finish', () => strm.close());
  db.tables.forEach(t => {
    strm.write(OxiGen.genCreateTableStatement(t) + "\n");
  })
  strm.end("-- end of generated text");
}

