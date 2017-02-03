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
    "userId": {
      "sqlType": "bytea",
      "tsType": "ArrayBuffer"
    },
    "userName": {
      "sqlType": "varchar(72)"
    },
    "uuid": {
      "sqlType": "varchar(36)"
    }
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
      { "name": "contentId", "type": "contentId" },
      { "name": "cryptHash", "type": "binary" },
      { "name": "amplifierId", "type": "userId" },
      { "name": "content", "type": "text" }
    ],
    "Link": [
      { "name": "linkId", "type": "linkId" },
      { "name": "amplifierId", "type": "userId" },
      { "name": "contentId", "type": "contentId" },
      { "name": "prevLink", "type": "linkId" },
      { "name": "hitCount", "type": "integer" },
    ],
    "User": [
      "userId",
      {
        "name": "created",
        "type": "timestamp"
      },
      {
        "name": "updated",
        "type": "timestamp"
      },
      "userName",
      { "name": "groups", "type": "userGroup", "multiValued": true }
    ]
  },
  "tables": {
    "auths": {
      "rowType": "Auth",
      "primaryKey": [
        "authId"
      ],
      "foreignKeys": [
        {
          "ref": "users",
          "columns": [
            "userId"
          ]
        }
      ]
    },
    "contents": {
      "rowType": "Content",
      "primaryKey": [
        "id"
      ]
    },
    "links": {
      "rowType": "Link",
      "primaryKey": [
        "linkId"
      ],
      "autoIncrement": "linkId",
      "foreignKeys": [
        {
          "ref": "content",
          "columns": [
            "contentId"
          ]
        },
        {
          "ref": "links",
          "columns": [
            "prevLink"
          ]
        }
      ],
    },
    "users": {
      "rowType": "User",
      "primaryKey": [
        "userId"
      ]
    }
  }
}