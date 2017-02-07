import * as fs from "fs";
import json from '../lib/model.js' ;

export type FK_Action = "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET_DEFAULT";

export interface IScalarType {
  name: string,
  tsType: string,
  sqlType: string,
  max?: number,
  min?: number,
  maxLen?: number,
  enum?: string[]
}

export interface IColumn {
  name: string,
  type: IScalarType,
  multiValued?: boolean,
  notNull?: boolean
}

export interface TupleType {
  name: string, 
  heading: IColumn[]
}

export interface IForeignKey {
  ref: string,
  columns: string[],
  name?: string,
  onDelete: FK_Action,
  onUpdate: FK_Action
}

export interface ITable {
  name: string,
  rowType: TupleType,
  primaryKey: string[],
  autoIncrement?: string,
  foreignKeys: IForeignKey[],
  uniques: string[][],
}

export interface IDbSchema {
  tables: Map<string, ITable>,
  dataTypes: Map<string, IScalarType>,
}

export function loadModel(model): IDbSchema {

  let dataTypes = new Map<string, IScalarType>();
  let tables = new Map<string, ITable>()
  let tupleTypes = new Map<string, TupleType>()
  

  let typs = model.scalarTypes;
  Object.keys(typs).forEach((k: string) => {
    let v: IScalarType = {name: k, tsType: "string", ...typs[k]};
    dataTypes.set(k, v);
  });

  let als = model.typeAliases;
  Object.keys(als).forEach((k: string) => {
    let t = dataTypes.get( als[k]);
    if (!t) throw new Error("Missing type for alias: "+k);
    let v: IScalarType = {...t, name: k};
    dataTypes.set(k, v);
  });

  let tups = model.tupleTypes;
  Object.keys(tups).forEach((k: string) => {
    let a: Array<any> = tups[k];
    let cols: IColumn[] = a.map(v => {
      if (typeof v === "string") {
        let typ = dataTypes.get(v);
        return { name: v, type: typ };
      }
      else {
        let t: string = v.type;
        let typ = dataTypes.get(t);
        if (!typ) {
          if (t.startsWith("varchar(")) {
            let nm = t.replace("(","_").replace(")","");
            let maxLen = parseInt(nm.substring(8))
            typ = {name: nm, sqlType: t, tsType: "string", maxLen };
            dataTypes.set(t, typ);
          } 
          else throw("unable to locate type for "+v.type);
        }
        return { ...v, type: typ };
      }
    });
    tupleTypes.set(k, {name: k, heading: cols});
  });

  let tbls = model.tables;
  Object.keys(tbls).forEach((k: string) => {
    let tbl = tbls[k];
    let tup = tupleTypes.get(tbl.rowType);
    if (!tup) throw new Error("missing tuple type : "+tbl.rowType);
    if (!tbl.foreignKeys) tbl.foreignKeys = [];
    if (!tbl.uniques) tbl.uniques = [];
    let pk = tbl.primaryKey;
    if (!pk) throw new Error("Table missing primary key : " + k);
    pk.forEach(c => {
      if (tup.heading.findIndex(col => col.name === c ) < 0) throw new Error("Malformed PK : "+ c);
    })
    tables.set(k, { ...tbl, name: k, rowType: tup});
  });

  tables.forEach(t => {
     t.foreignKeys.forEach(fk => {
       if (!tables.has(fk.ref)) throw new Error("Invalid Foreign Key ref: " + fk.ref + " on table: "+t.name);
       // should also check arity of keys etc.
     });
  });
  return { tables, dataTypes };
}

function cnm(c: string): string {   // postgres column naming 
  return (c.toLowerCase() === c) ? c :'"' + c + '"';
}

function colnm(col: IColumn): string {   // postgres column naming 
  return cnm(col.name);
}

function filterCols(tbl: ITable, data: Object = null): IColumn[] {
  let cols = tbl.rowType.heading;
  if (data) cols = cols.filter(c => (data.hasOwnProperty(c.name) && data[c.name] !== undefined) );
  return cols;
}

export function columnNames(tbl: ITable, data: Object = null): string[] {
  return filterCols(tbl, data).map( colnm );
}

export function columnRefs(tbl: ITable, data: Object = null): string[] {
  return filterCols(tbl, data).map( c => '${'+c.name+'}' );
}

export function columnSets(tbl: ITable, data: Object = null): string[] {
  return filterCols(tbl, data).filter(c => tbl.primaryKey.indexOf(c.name) < 0).map( c => colnm(c) + ' = ${'+c.name+'}' );
}

export function genInsertColumns(tbl: ITable, data: Object = null): string {
  //if (tbl.autoIncrement) data[tbl.autoIncrement] = 0; 
  let cols = filterCols(tbl, data);
  if (tbl.autoIncrement) {
    let i = cols.findIndex(c => c.name === tbl.autoIncrement);
    if (i < 0 && !data) throw new Error("invalid valid value for autoIncrement field: "+tbl.autoIncrement);
    if (i >= 0) cols.splice(i, 1);
  }
  return '('+ cols.map( colnm ).join() +')';
}

export function genInsertValues(tbl: ITable, data: Object = null): string {
  let cols = filterCols(tbl, data)
  if (tbl.autoIncrement) {
    let i = cols.findIndex(c => c.name === tbl.autoIncrement);
    if (i >= 0) cols.splice(i,1);
  }
  let refs = cols.map( c => '${'+c.name+'}' );
  return '('+ refs.join() +')';
}

export function genInsertStatement(tbl: ITable, data: Object = null): string {
  let stmt = "INSERT INTO "+tbl.name + genInsertColumns(tbl, data) + " VALUES " + genInsertValues(tbl, data);
  if (tbl.autoIncrement) stmt += ' RETURNING "'+tbl.autoIncrement+'"';
  return stmt;
}

export function genUpdateStatement(tbl: ITable, data: Object = null): string {
  if (data) {
    tbl.primaryKey.forEach(s => {if (data[s] == null || data[s] == undefined) throw new Error("Primary Key value(s) missing"); } );
  }
  let where = tbl.primaryKey.map( c => cnm(c) + ' = ${'+c+'}' ).join(' AND ');
  return "UPDATE "+ tbl.name + " SET" + columnSets(tbl, data).join() + " WHERE " + where ;
}

export function genUpsertStatement(tbl: ITable, data: Object = null): string {
  if (tbl.autoIncrement)  throw new Error("Cannot use upsert: "+tbl.name+ "table has autoIncrement column");
  let istmt = genInsertStatement(tbl, data);
  let ustmt = "UPDATE SET" + columnSets(tbl, data).join();
  let pk = tbl.primaryKey.map( cnm ).join();
  return istmt + " on conflict(" + pk + ") do " + ustmt;
}

export function genTypescriptType(tbl: ITable): string {
  let lns = tbl.rowType.heading.map( c => {
    return "\n  readonly "+ c.name + ": "+ c.type.name + (c.multiValued ? '[]' : '') + (c.notNull ? '' : ' | null')  
  });
  return "export interface "+tbl.rowType.name+" {" +  lns.join() + "\n};";
}

export function genCreateTableStatement(tbl: ITable): string {
  let cols = tbl.rowType.heading.map( c => {
    return colnm(c) + " " + 
        (c.name === tbl.autoIncrement ? 'SERIAL' : c.type.sqlType + (c.multiValued ? '[]' : '') + (c.notNull ? ' NOT NULL' : '') );
  });
  let stmt =  "CREATE TABLE "+tbl.name+" (\n  " +  cols.join(",\n  ");
  stmt += ",\n  PRIMARY KEY (" + tbl.primaryKey.map(cnm).join(",")+")";
  tbl.foreignKeys.forEach(fk => {
    stmt += ",\n "+ (fk.name ? "CONSTRAINT" + fk.name : "") +" FOREIGN KEY (" + fk.columns.map(cnm).join(",")+")"
          +  "\n    REFERENCES " + fk.ref 
          +  "\n    ON UPDATE " + (fk.onUpdate || "NO ACTION")
          +  "\n    ON DELETE " + (fk.onDelete || "NO ACTION")
  });
  tbl.uniques.forEach(unq => {
    stmt += ",\n UNIQUE (" + unq.map(cnm).join(",")+")"
  });
  stmt += "\n);\n";
  return stmt;
}

export function writeTypescriptTypesToFile(db: IDbSchema, fname: string): void {
  let strm = fs.createWriteStream(fname, {flags: 'w', encoding: 'utf8'});
  strm.write("// This file is generated - it should not be edited\n\n");
  strm.on('finish', () => strm.close() );
  db.dataTypes.forEach(t => {
    let typ = t.enum ?  t.enum.map(s => '"'+s+'"').join(" | ")
                     : ( t.tsType || "string" )
    if (t.name !== typ) strm.write("\nexport type " + t.name + " = " + typ + ";");                     
  })
  strm.write("\n\n");

  db.tables.forEach(t => {
    let ts = genTypescriptType(t);
    strm.write(ts + "\n\n");
  })
  strm.end("// end of generated types");
}

export function writeTableCreateStatementsToFile(db: IDbSchema, fname: string): void {
  let strm = fs.createWriteStream(fname, {flags: 'w', encoding: 'utf8'});
  strm.write("-- This file is generated - it (probably) should not be edited\n\n");
  strm.on('finish', () => strm.close() );
  db.tables.forEach(t => {
    strm.write( genCreateTableStatement(t)+"\n" );                     
  })
  strm.end("-- end of generated text");
}

export function defaultValue(typ: IScalarType): any {
  if (typ.enum) return [];
  switch (typ.name) {
    case "string" : return "";
    case "number" : return typ.max ? typ.min : 0;
    case "date" : return new Date();
    case "boolean": return false;
  }
}

export function emptyRec<T>(tbl: ITable):  T {
  let rslt = Object.create(null);
  tbl.rowType.heading.forEach( c => rslt[c.name] = undefined );
  return rslt;
} 

export const dbSchema =  loadModel(json)

