export default {
  "scalarTypes": {
    "authId": {
      "sqlType": "varchar(128)"
    },
    "authProvider": {
      "sqlType": "varchar(36)",
      "enum": [
        "facebook",
        "github",
        "twitter",
        "linkedin",
        "chrome",
      ]
    },
    "binary": {
      "tsType": "Buffer",
      "sqlType": "bytea"
    },
    "boolean": {
      "tsType": "boolean",
      "sqlType": "boolean"
    },
    "contentType": {
      "sqlType": "varchar(10)",
      "enum": [
        "video",
        "post",
        "audio",
        "image",
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
    "ipAddress": {
      "tsType": "string",
      "sqlType": "varchar(30)"
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
      "sqlType": "varchar(2000)"
    },
    "userName": {
      "sqlType": "varchar(72)"
    },
    "uuid": {
      "sqlType": "varchar(36)"
    }
  },
  "typeAliases": {
    "content": "text",
    "blobId": "integer",
    "contentId": "integer",
    "contentCryptId": "binary",
    "publicKey": "binary",
    "userId": "uuid",
  },
  "tupleTypes": {
    "Auth": ["authProvider", "authId", "userId", "created", "updated"],
    "Blob": ["blobId", "created", "updated",
      { "name": "blobContent", "type": "binary" },
    ],
    "Content": ["contentId", "contentType", "userId", "blobId", "content", "created", "updated",
      { "name": "mime_ext", "type": "varchar(8)" },
      { "name": "title", "type": "varchar(254)" },
      { "name": "tags", "type": "varchar(20)", "multiValued": true },
      { "name": "cryptHash", "type": "binary" },
      { "name": "published", "type": "timestamp" },
    ],
    "Invitation": ["ipAddress", "linkId", "created", "updated"],
    "Link": ["linkId", "userId", "linkDescription", "created", "updated",
      { "name": "url", "type": "urlString" },
      { "name": "tags", "type": "varchar(20)", "multiValued": true },
      { "name": "prevLink", "type": "linkId" },
      { "name": "hitCount", "type": "integer", "default": "0" },
      { "name": "amount", "type": "integer" },
    ],
    "Promotion": ["linkId", "userId", "created", "updated",
      { "name": "delivered", "type": "timestamp" }
    ],
    "User": ["userId", "publicKey", "userName", "email", "created", "updated",
      { "name": "credits", "type": "integer" },
      { "name": "groups", "type": "userGroup", "multiValued": true }
    ],
    "UserLink": [
      { "name": "user_A", "type": "userId" },
      { "name": "user_B", "type": "userId" },
      { "name": "tags", "type": "varchar(20)", "multiValued": true },
      "created",
      "updated",
    ],
    "View": ["userId", "linkId", "created", "updated"]
  },
  "tables": {   // the order of entries here is significant.  foreign keys can only reference preceding entries
    "users": {
      "rowType": "User",
      "primaryKey": ["userId"],
      "uniques": [["userName"]],
      "updated": "updated",
    },
    "userlinks": {
      "rowType": "UserLink",
      "primaryKey": ["user_A", "user_B"],
      "foreignKeys": [
        { "ref": "users", "columns": ["user_A"] },
        { "ref": "users", "columns": ["user_B"] },
      ],
      "updated": "updated",
    },
    "auths": {
      "rowType": "Auth",
      "primaryKey": ["authProvider", "authId"],
      "updated": "updated",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] }
      ],
    },
    "blobs": {
      "rowType": "Blob",
      "primaryKey": ["blobId"],
      "autoIncrement": "blobId",
      "updated": "updated",
    },
    "contents": {
      "rowType": "Content",
      "primaryKey": ["contentId"],
      "autoIncrement": "contentId",
      "updated": "updated",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] },
        { "ref": "blobs", "columns": ["blobId"] },
      ],
      "uniques": [["contentType", "title"]],
    },
    "links": {
      "rowType": "Link",
      "primaryKey": ["linkId"],
      "autoIncrement": "linkId",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] },
        { "ref": "links", "columns": ["prevLink"] },
      ],
      "uniques": [["url", "userId"]],
    },
    "invitations": {
      "rowType": "Invitation",
      "primaryKey": ["ipAddress"],
      "updated": "updated",
      "foreignKeys": [
        { "ref": "links", "columns": ["linkId"] },
      ],
    },
    "promotions": {
      "rowType": "Promotion",
      "primaryKey": ["linkId", "userId"],
      "updated": "updated",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] },
        { "ref": "links", "columns": ["linkId"], "onDelete": "CASCADE" },
      ],
    },
    "views": {
      "rowType": "View",
      "primaryKey": ["userId", "linkId"],
      "updated": "updated",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] },
        { "ref": "links", "columns": ["linkId"], "onDelete": "CASCADE" },
      ],
    }
  }
}