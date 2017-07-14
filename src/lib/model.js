export default {
  scalarTypes: {
    authId: {
      sqlType: "varchar(128)"
    },
    authProvider: {
      sqlType: "varchar(36)",
      enum: [
        "facebook",
        "github",
        "twitter",
        "linkedin",
        "chrome",
      ]
    },
    binary: {
      tsType: "Buffer",
      sqlType: "bytea"
    },
    boolean: {
      tsType: "boolean",
      sqlType: "boolean"
    },
    contentType: {
      sqlType: "varchar(10)",
      enum: [
        "post",
        "video",
        "audio",
        "image",
        "bookmark",
      ]
    },
    created: {
      tsType: "Date",
      sqlType: "timestamptz",
      sqlDefault: "CURRENT_TIMESTAMP"
    },
    date: {
      tsType: "Date",
      sqlType: "date"
    },
    db_hash: {
      sqlType: "varchar(200)",
    },
    email: {
      tsType: "string",
      sqlType: "varchar(160)"
    },
    integer: {
      tsType: "number",
      sqlType: "integer"
    },
    ipAddress: {
      tsType: "string",
      sqlType: "varchar(30)"
    },
    json: {
      sqlType: "jsonb"
    },
    hashId: {
      tsType: "string",
      sqlType: "varchar(6)"
    },
    percentage: {
      tsType: "number",
      sqlType: "integer",
      max: 100,
      min: 0
    },
    tag: {
      tsType: "string",
      sqlType: "varchar(20)"
    },
    text: {
      tsType: "string",
      sqlType: "text"
    },
    timestamp: {
      tsType: "Date",
      sqlType: "timestamptz"
    },
    title: {
      tsType: "string",
      sqlType: "varchar(254)"
    },
    updated: {
      tsType: "Date",
      sqlType: "timestamptz",
      sqlDefault: "CURRENT_TIMESTAMP"
    },
    userGroup: {
      sqlType: "varchar(10)",
      enum: [
        "admin",
        "creator",
        "member"
      ]
    },
    urlString: {
      sqlType: "varchar(2000)"
    },
    userName: {
      sqlType: "varchar(72)"
    },
    uuid: {
      sqlType: "varchar(36)"
    }
  },
  typeAliases: {
    content: "text",
    blobId: "integer",
    blobContent: "binary",
    contentId: "hashId",
    comment: "text",
    commentId: "integer",
    isPublic: "boolean",
    linkId: "hashId",
    payment: "integer",
    paymentSchedule: "integer[]",
    publicKey: "binary",
    published: "timestamp",
    userId: "uuid",
    userList: "userName[]",
    viewId: "integer",
    tags: "tag[]",
  },
  tupleTypes: {
    Auth: ["authProvider", "authId", "userId", "created", "updated"],
    Blob: ["db_hash", "blobId", "created", "userId",
      { name: "peaks", type: "text" },
    ],
    Content: ["contentId", "contentType", "title", "userId", "db_hash", "content", "created", "updated", "isPublic", "tags",
      { name: "url", type: "urlString" },
      { name: "mime_ext", type: "varchar(8)" },
    ],
    Comment: ["commentId", "contentId", "userId", "comment", "created", "updated",
      { name: "parent", type: "commentId" },
    ],
    Invitation: ["ipAddress", "linkId", "created", "updated"],
    Link: ["linkId", "userId", "contentId", "title", "created", "updated", "comment", "isPublic", "tags", "paymentSchedule",
      { name: "prevLink", type: "linkId" },
      { name: "amount", type: "integer" },
    ],
    PurchasedLink: ["linkId", "userId", "created", "updated",
      { name: "totalPayment", type: "payment" }
    ],
    Promotion: ["linkId", "userId", "created", "updated",
      { name: "delivered", type: "timestamp" }
    ],
    Feed: ["linkId", "userId", "created", "updated",
      { name: "dismissed", type: "timestamp" },
    ],
    User: ["userId", "userName", "created", "updated",
      { name: "home_page", type: "urlString" },
      { name: "info", type: "text" },
      { name: "profile_pic", type: "db_hash" },
      { name: "credits", type: "integer" },
      { name: "subscriptions", type: "tags" },
      { name: "blacklist", type: "tags" },
      { name: "groups", type: "userGroup", multiValued: true },
      { name: "following", type: "userId", multiValued: true },
      { name: "last_feed", type: "timestamp" },
    ],
    View: ["viewId", "userId", "linkId", "created", "payment"],
    ContentView: ["viewId", "userId", "contentId", "linkId", "ipAddress", "created"],
  },
  tables: {   // the order of entries here is significant.  foreign keys can only reference preceding entries
    users: {  // can't create fk for blob as it would create circular fk refs b/w blobs and users.
      rowType: "User",
      primaryKey: ["userId"],
      uniques: [["userName"]],
      updated: "updated",
    },
    auths: {
      rowType: "Auth",
      primaryKey: ["authProvider", "authId"],
      updated: "updated",
      foreignKeys: [
        { ref: "users", columns: ["userId"] }
      ],
    },
    blobs: {
      rowType: "Blob",
      primaryKey: ["db_hash"],
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
      ],
    },
    contents: {
      rowType: "Content",
      primaryKey: ["contentId"],
      updated: "updated",
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
        { ref: "blobs", columns: ["db_hash"] },
      ],
    },
    comments: {
      rowType: "Comment",
      primaryKey: ["commentId"],
      autoIncrement: "commentId",
      updated: "updated",
      foreignKeys: [
        { ref: "comments", columns: ["parent"] },
        { ref: "contents", columns: ["contentId"], onDelete: "CASCADE" },
        { ref: "users", columns: ["userId"] },
      ],
    },
    links: {
      rowType: "Link",
      primaryKey: ["linkId"],
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
        { ref: "contents", columns: ["contentId"] },
        { ref: "links", columns: ["prevLink"] },
      ],
    },
    invitations: {
      rowType: "Invitation",
      primaryKey: ["ipAddress"],
      updated: "updated",
      foreignKeys: [
        { ref: "links", columns: ["linkId"] },
      ],
    },
    promotions: {
      rowType: "Promotion",
      primaryKey: ["linkId", "userId"],
      updated: "updated",
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
        { ref: "links", columns: ["linkId"], onDelete: "CASCADE" },
      ],
    },
    feeds: {
      rowType: "Feed",
      primaryKey: ["linkId", "userId"],
      updated: "updated",
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
        { ref: "links", columns: ["linkId"], onDelete: "CASCADE" },
      ],
    },
    views: {
      rowType: "View",
      primaryKey: ["viewId"],
      autoIncrement: "viewId",
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
        { ref: "links", columns: ["linkId"], onDelete: "CASCADE" },
      ],
    },
    contentviews: {
      rowType: "ContentView",
      primaryKey: ["viewId"],
      autoIncrement: "viewId",
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
        { ref: "contents", columns: ["contentId"], onDelete: "CASCADE" },
      ],
    }
  }
}