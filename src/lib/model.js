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
    "contentCryptId": {
      "tsType": "ArrayBuffer",
      "sqlType": "bytea"
    },
    "contentType": {
      "sqlType": "varchar(10)",
      "enum": [
        "url",
        "video",
        "post",
        "audio"
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
    "publicKey": {
      "sqlType": "bytea",
      "tsType": "any"  // needs fixing
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
    "postId": "integer",
    "content": "urlString",
    "contentId": "integer",
    "userId": "uuid",
  },
  "tupleTypes": {
    "Auth": ["authProvider", "authId", "userId", "created", "updated"],
    "Content": ["contentId", "contentType", "userId", "content", "created", "updated",
      { "name": "cryptHash", "type": "binary" },
    ],
    "Invitation": ["ipAddress", "linkId", "created", "updated"],
    "Link": ["linkId", "userId", "contentId", "linkDescription", "created", "updated",
      { "name": "prevLink", "type": "linkId" },
      { "name": "hitCount", "type": "integer", "default": "0" },
      { "name": "amount", "type": "integer" },
    ],
    "Post": ["postId", "userId", "created", "updated", "contentId",
      { "name": "title", "type": "varchar(160)" },
      { "name": "body", "type": "text" },
      { "name": "tags", "type": "varchar(20)", "multiValued": true },
    ],
    "Promotion": ["linkId", "userId", "created", "updated",
      { "name": "delivered", "type": "timestamp" }
    ],
    "User": ["userId", "publicKey", "userName", "email", "ipAddress", "created", "updated",
      { "name": "ampCredits", "type": "integer" },
      { "name": "groups", "type": "userGroup", "multiValued": true }
    ],
    "UserLink": [
      { "name": "user_A", "type": "userId" },
      { "name": "user_B", "type": "userId" },
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
    /*  we will calculate these from the links table for the moment
    "userlinks": {
      "rowType": "UserLink",
      "primaryKey": [ "user_A", "user_B" ],
      "foreignKeys": [
        { "ref": "users", "columns": [ "user_A" ] },
        { "ref": "users", "columns": [ "user_B" ] },
      ]
      "updated": "updated",
    },
    */
    "auths": {
      "rowType": "Auth",
      "primaryKey": ["authProvider", "authId"],
      "updated": "updated",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] }
      ],
    },
    "contents": {
      "rowType": "Content",
      "primaryKey": ["contentId"],
      "autoIncrement": "contentId",
      "uniques": [["content"]],
      "updated": "updated",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] },
      ],
    },
    "links": {
      "rowType": "Link",
      "primaryKey": ["linkId"],
      "autoIncrement": "linkId",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] },
        { "ref": "contents", "columns": ["contentId"] },
        { "ref": "links", "columns": ["prevLink"] },
      ],
      "uniques": [["contentId", "userId"]],
    },
    "posts": {
      "rowType": "Post",
      "primaryKey": ["postId"],
      "autoIncrement": "postId",
      "updated": "updated",
      "foreignKeys": [
        { "ref": "users", "columns": ["userId"] },
        { "ref": "contents", "columns": ["contentId"] },
      ],
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