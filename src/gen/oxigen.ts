import json from '../lib/model.js';

export const dbSchema = loadModel(json)

export type FK_Action = "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET_DEFAULT";

export interface IScalarType {
  name: string,
  tsType: string,
  sqlType: string,
  sqlDefault?: string,
  max?: number,
  min?: number,
  maxLen?: number,
  enum?: string[],
  multiValued?: boolean
}

export interface IColumn {
  name: string,
  type: IScalarType,
  multiValued?: boolean,
  notNull?: boolean,
  default?: string
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
  updated?: string,    //  used to automagically maintain "last updated" columns
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
    let v: IScalarType = { name: k, tsType: "string", ...typs[k] };
    dataTypes.set(k, v);
  });

  let als = model.typeAliases;
  Object.keys(als).forEach((k: string) => {
    let tv: string = als[k];
    let multiValued = false
    if (tv.endsWith("[]")) {
      multiValued = true;
      tv = tv.replace("[]", "");
    }
    let t = dataTypes.get(tv);
    if (!t) throw new Error("Missing type for alias: " + k);
    let v: IScalarType = { ...t, name: k, multiValued };
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
            let nm = t.replace("(", "_").replace(")", "");
            let maxLen = parseInt(nm.substring(8))
            typ = { name: nm, sqlType: t, tsType: "string", maxLen };
            dataTypes.set(t, typ);
          }
          else throw ("unable to locate type for " + v.type);
        }
        return { ...v, type: typ };
      }
    });
    tupleTypes.set(k, { name: k, heading: cols });
  });

  let tbls = model.tables;
  Object.keys(tbls).forEach((k: string) => {
    let tbl = tbls[k];
    let tup = tupleTypes.get(tbl.rowType);
    if (!tup) throw new Error("missing tuple type : " + tbl.rowType);
    if (!tbl.foreignKeys) tbl.foreignKeys = [];
    if (!tbl.uniques) tbl.uniques = [];
    let pk = tbl.primaryKey;
    if (!pk) throw new Error("Table missing primary key : " + k);
    pk.forEach(c => {
      if (tup.heading.findIndex(col => col.name === c) < 0) throw new Error("Malformed PK : " + c);
    })
    tables.set(k, { ...tbl, name: k, rowType: tup });
  });

  tables.forEach(t => {
    t.foreignKeys.forEach(fk => {
      if (!tables.has(fk.ref)) throw new Error("Invalid Foreign Key ref: " + fk.ref + " on table: " + t.name);
      // should also check arity of keys etc.
    });
  });
  return { tables, dataTypes };
}

export function cnm(c: string): string {   // postgres column naming 
  return (c.toLowerCase() === c) ? c : '"' + c + '"';
}

function colnm(col: IColumn): string {   // postgres column naming 
  return cnm(col.name);
}

function filterCols(tbl: ITable, data: Object = null): IColumn[] {
  let cols = tbl.rowType.heading;
  if (data) cols = cols.filter(c => (data.hasOwnProperty(c.name) && data[c.name] !== undefined));
  return cols;
}

function extColRef(c: IColumn): string {
  let ext = '';
  if (c.multiValued || c.type.multiValued) {
    let typ = c.type.sqlType;
    if (typ.startsWith('varchar')) typ = 'text';
    ext = '::' + typ + '[]';
  }
  return '${' + c.name + '}' + ext;
}


export function columnNames(tbl: ITable, data: Object = null): string[] {
  return filterCols(tbl, data).map(colnm);
}

export function columnRefs(tbl: ITable, data: Object = null): string[] {
  return filterCols(tbl, data).map(c => '${' + c.name + '}');
}

export function columnSets(tbl: ITable, data: Object = null): string[] {
  return filterCols(tbl, data).filter(c => tbl.primaryKey.indexOf(c.name) < 0).map(c => colnm(c) + ' = ' + extColRef(c));
}

export function genInsertColumns(tbl: ITable, data: Object = null): string {
  //if (tbl.autoIncrement) data[tbl.autoIncrement] = 0; 
  let cols = filterCols(tbl, data);
  if (tbl.autoIncrement) {
    let i = cols.findIndex(c => c.name === tbl.autoIncrement);
    if (i < 0 && !data) throw new Error("invalid valid value for autoIncrement field: " + tbl.autoIncrement);
    if (i >= 0) cols.splice(i, 1);
  }
  return '(' + cols.map(colnm).join() + ')';
}

export function genInsertValues(tbl: ITable, data: Object = null): string {
  let cols = filterCols(tbl, data)
  if (tbl.autoIncrement) {
    let i = cols.findIndex(c => c.name === tbl.autoIncrement);
    if (i >= 0) cols.splice(i, 1);
  }
  let refs = cols.map(c => extColRef(c));
  return '(' + refs.join() + ')';
}

export function genInsertStatement(tbl: ITable, data: Object = null): string {
  let stmt = "INSERT INTO " + tbl.name + genInsertColumns(tbl, data) + " VALUES " + genInsertValues(tbl, data);
  stmt += ' RETURNING ' + columnNames(tbl).join();
  return stmt;
}

export function genRetrieveStatement(tbl: ITable, data: Object = null): string {
  let pk = tbl.primaryKey
  let where = tbl.primaryKey.map(c => cnm(c) + ' = ${' + c + '}').join(' AND ');
  let stmt = "SELECT * FROM " + tbl.name + " WHERE " + where;
  return stmt;
}

export function genDeleteStatement(tbl: ITable, data: Object = null): string {
  let pk = tbl.primaryKey
  let where = tbl.primaryKey.map(c => cnm(c) + ' = ${' + c + '}').join(' AND ');
  let stmt = "DELETE FROM " + tbl.name + " WHERE " + where;
  return stmt;
}

export function genUpdateStatement(tbl: ITable, data: Object = null): string {
  let updtd = '';
  if (data) {
    tbl.primaryKey.forEach(s => { if (data[s] == null || data[s] == undefined) throw new Error("Primary Key value(s) missing"); });
    if (tbl.updated) {
      data[tbl.updated] = undefined;
      updtd = `, "${tbl.updated}" = DEFAULT`;
    }
  }
  let where = tbl.primaryKey.map(c => cnm(c) + ' = ${' + c + '}').join(' AND ');
  let stmt = "UPDATE " + tbl.name + " SET " + columnSets(tbl, data).join() + updtd + " WHERE " + where + ' RETURNING ' + columnNames(tbl).join();
  return stmt;
}

export function genUpsertStatement(tbl: ITable, data: Object = null): string {
  if (tbl.autoIncrement) throw new Error("Cannot use upsert: " + tbl.name + " table has autoIncrement column");
  let istmt = "INSERT INTO " + tbl.name + genInsertColumns(tbl, data) + " VALUES " + genInsertValues(tbl, data);
  let ustmt = "UPDATE SET " + columnSets(tbl, data).join();
  let pk = tbl.primaryKey.map(cnm).join();
  return istmt + " on conflict(" + pk + ") do " + ustmt + ' RETURNING ' + columnNames(tbl).join();
}

export function genTypescriptType(tbl: ITable): string {
  let lns = tbl.rowType.heading.map(c => {
    return "\n  readonly " + c.name + ": " + c.type.name + (c.multiValued ? '[]' : '') + (c.notNull ? '' : ' | null');
  });
  return "export interface " + tbl.rowType.name + " {" + lns.join() + "\n};";
}

export function unqName(tbl: ITable, nms: string[]): string {
  return `${tbl.name}_${nms.join("_")}_key`;
}

export function genAddUniqueStatement(tbl: ITable, nms: string[]): string {
  return `ALTER TABLE public.${tbl.name} ADD CONSTRAINT ${cnm(unqName(tbl, nms))} UNIQUE (${nms.map(cnm).join()})`;
}

export function fkName(tbl: ITable, fk: IForeignKey) {
  return fk.name || `${tbl.name}_${fk.columns.join("_")}_fkey`;
}

export function foreignKeyClause(tbl: ITable, fk: IForeignKey) {
  return "CONSTRAINT " + cnm(fkName(tbl, fk)) + " FOREIGN KEY (" + fk.columns.map(cnm).join(",") + ")"
    + "\n    REFERENCES " + fk.ref
    + "\n    ON UPDATE " + (fk.onUpdate || "NO ACTION")
    + "\n    ON DELETE " + (fk.onDelete || "NO ACTION")
}

export function genAddForeignKeyStatement(tbl: ITable, fk: IForeignKey) {
  return `ALTER TABLE public.${tbl.name} ADD ${foreignKeyClause(tbl, fk)}`;
}

export function pkName(tbl: ITable) {
  return tbl.name + "_pkey";
}

export function genAddPrimaryKeyStatement(tbl: ITable) {
  return `ALTER TABLE public.${tbl.name} ADD CONSTRAINT ${pkName(tbl)} PRIMARY KEY (${tbl.primaryKey.map(cnm).join()})`;
}

export function genCreateTableStatement(tbl: ITable): string {
  let cols = tbl.rowType.heading.map(c => {
    let dflt = c.default ? c.default : c.type.sqlDefault ? c.type.sqlDefault : null;
    return colnm(c) + " " + (c.name === tbl.autoIncrement ? 'SERIAL' : c.type.sqlType + ((c.type.multiValued || c.multiValued) ? '[]' : ''))
      + (c.notNull ? ' NOT NULL' : '') + (dflt ? ' DEFAULT ' + dflt : '');
  });
  let stmt = "CREATE TABLE " + tbl.name + " (\n  " + cols.join(",\n  ");
  stmt += ",\n  PRIMARY KEY (" + tbl.primaryKey.map(cnm).join(",") + ")";
  tbl.foreignKeys.forEach(fk => {
    stmt += ",\n " + foreignKeyClause(tbl, fk);
  });
  tbl.uniques.forEach(unq => {
    stmt += ",\n UNIQUE (" + unq.map(cnm).join(",") + ")"
  });
  stmt += "\n);\n";
  return stmt;
}

export function defaultValue(typ: IScalarType): any {
  if (typ.enum) return [];
  switch (typ.name) {
    case "string": return "";
    case "number": return typ.max ? typ.min : 0;
    case "date": return new Date();
    case "boolean": return false;
  }
}

export function emptyRec<T>(tblnm: string): T {
  let tbl = dbSchema.tables.get(tblnm);
  let rslt = Object.create(null);
  tbl.rowType.heading.forEach(c => rslt[c.name] = undefined);
  return rslt;
}


