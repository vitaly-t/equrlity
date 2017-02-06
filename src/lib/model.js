export default {
  "scalarTypes": {
    "authId": {
      "sqlType": "varchar(128)"
    },
    "binary": {
      "tsType": "ArrayBuffer",
      "sqlType": "bytea"
    },
    "boolean": {
      "tsType": "boolean",
      "sqlType": "boolean"
    },
    "contentId": {
      "tsType": "number",
      "sqlType": "integer"
    },
    "contentCryptId": {
      "tsType": "ArrayBuffer",
      "sqlType": "bytea"
    },
    "contentType": {
      "sqlType": "varchar(10)",
      "enum": [
        "url",
        "yt_video",
        "text",
        "mp3"
      ]
    },
    "date": {
      "tsType": "Date",
      "sqlType": "date"
    },
    "integer": {
      "tsType": "number",
      "sqlType": "integer"
    },
    "json": {
      "sqlType": "jsonb"
    },
    "linkId": {
      "tsType": "number",
      "sqlType": "integer"
    },
    "percentage": {
      "tsType": "number",
      "sqlType": "integer",
      "max": 100,
      "min": 0
    },
    "publicKey": {
      "sqlType": "bytea",
      "tsType": "ArrayBuffer"
    },
    "text": {
      "tsType": "string",
      "sqlType": "text"
    },
    "timestamp": {
      "tsType": "Date",
      "sqlType": "timestamp"
    },
    "userGroup": {
      "sqlType": "varchar(10)",
      "enum": [
        "admin",
        "author",
        "member"
      ]
    },
    "userName": {
      "sqlType": "varchar(72)"
    },
    "uuid": {
      "sqlType": "varchar(36)"
    }
  },
  "typeAliases": { 
    "userId": "uuid",
  },
  "tupleTypes": {
    "Auth": [
      "authId",
      "userId",
      {
        "name": "created",
        "type": "timestamp"
      },
      {
        "name": "updated",
        "type": "timestamp"
      }
    ],
    "Content": [
      "contentId", 
      "contentType",
      "userId",
      { "name": "cryptHash", "type": "binary" },
      { "name": "content", "type": "text" }
    ],
    "Link": [
      "linkId",
      "userId",
      "contentId",
      { "name": "prevLink", "type": "linkId" },
      { "name": "hitCount", "type": "integer" },
      { "name": "amount", "type": "integer" },
    ],
    "User": [
      "userId",
      "publicKey",
      "userName",
      { "name": "created", "type": "timestamp" },
      { "name": "updated", "type": "timestamp" },
      { "name": "groups", "type": "userGroup", "multiValued": true }
    ]
  },
  "tables": {
    "users": {
      "rowType": "User",
      "primaryKey": [ "userId" ],
    },
    "auths": {
      "rowType": "Auth",
      "primaryKey": [ "authId" ],
      "foreignKeys": [
        { "ref": "users", "columns": [ "userId" ] }
      ]
    },
    "contents": {
      "rowType": "Content",
      "primaryKey": [ "contentId" ],
      "autoIncrement": "contentId",
      "uniques": [ [ "content" ] ],
      "foreignKeys": [
        { "ref": "users", "columns": [ "userId" ]  },
      ],
    },
    "links": {
      "rowType": "Link",
      "primaryKey": [
        "linkId"
      ],
      "autoIncrement": "linkId",
      "foreignKeys": [
        { "ref": "users", "columns": [ "userId" ]  },
        { "ref": "contents", "columns": [ "contentId" ]  },
        { "ref": "links", "columns": [ "prevLink" ] },
      ],
    },
  }
}