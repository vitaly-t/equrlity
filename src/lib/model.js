export default {
  "scalarTypes": {
    "authId": {
      "sqlType": "varchar(128)"
    },
    "authProvider": {
      "sqlType": "varchar(36)",
      "enum": [
        "ip",
        "facebook",
        "github",
        "twitter",
        "linkedin",
      ]
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
    "created": {
      "tsType": "Date",
      "sqlType": "timestamptz",
      "sqlDefault": "CURRENT_TIMESTAMP"
    },
    "date": {
      "tsType": "Date",
      "sqlType": "date"
    },
    "email": {
      "tsType": "string",
      "sqlType": "varchar(160)"
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
    "linkDescription": {
      "tsType": "string",
      "sqlType": "varchar(100)"
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
      "sqlType": "timestamptz"
    },
    "updated": {
      "tsType": "Date",
      "sqlType": "timestamptz",
      "sqlDefault": "CURRENT_TIMESTAMP"
    },
    "userGroup": {
      "sqlType": "varchar(10)",
      "enum": [
        "admin",
        "author",
        "member"
      ]
    },
    "urlString": {
      "sqlType": "varchar(250)"
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
    "content": "text",
  },
  "tupleTypes": {
    "Auth": [ "authProvider", "authId", "userId", "created", "updated" ],
    "Content": [ "contentId", "contentType", "userId", "content",
      { "name": "cryptHash", "type": "binary" },
    ],
    "Link": [ "linkId", "userId", "contentId", "linkDescription", "created", "updated",
      { "name": "prevLink", "type": "linkId" },
      { "name": "hitCount", "type": "integer", "default": "0"},
      { "name": "amount", "type": "integer" },
    ],
    "Promotion": [ "linkId", "userId", "created",
      { "name": "delivered", "type": "timestamp"}
    ],
    "User": [ "userId", "publicKey", "userName", "email", "created", "updated",
      { "name": "ampCredits", "type": "integer" },
      { "name": "groups", "type": "userGroup", "multiValued": true }
    ],
    "UserLink": [
      { "name": "user_A", "type": "userId"},
      { "name": "user_B", "type": "userId"},
      "created",
      "updated",
    ],
    "View": [ "userId", "linkId", "created" ]
  },
  "tables": {
    "users": {
      "rowType": "User",
      "primaryKey": [ "userId" ],
      "uniques": [ ["userName"] ],
    },
    /*  we will calculate these from the links table for the moment
    "userlinks": {
      "rowType": "UserLink",
      "primaryKey": [ "user_A", "user_B" ],
      "foreignKeys": [
        { "ref": "users", "columns": [ "user_A" ] },
        { "ref": "users", "columns": [ "user_B" ] },
      ]
    },
    */
    "auths": {
      "rowType": "Auth",
      "primaryKey": [ "authProvider","authId" ],
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
      "primaryKey": [ "linkId" ],
      "autoIncrement": "linkId",
      "foreignKeys": [
        { "ref": "users", "columns": [ "userId" ]  },
        { "ref": "contents", "columns": [ "contentId" ]  },
        { "ref": "links", "columns": [ "prevLink" ] },
      ],
      "uniques": [ [ "contentId", "userId" ] ],
    },
    "promotions": {
      "rowType": "Promotion",
      "primaryKey": [ "linkId", "userId"],
      "foreignKeys": [
        { "ref": "users", "columns": [ "userId" ] },
        { "ref": "links", "columns": [ "linkId" ], "onDelete": "CASCADE" },
      ],
    },
    "views": {
      "rowType": "View",
      "primaryKey": [ "userId", "linkId"],
      "foreignKeys": [
        { "ref": "users", "columns": [ "userId" ]  },
        { "ref": "links", "columns": [ "linkId" ], "onDelete": "CASCADE" },
      ],
    }
  }
}