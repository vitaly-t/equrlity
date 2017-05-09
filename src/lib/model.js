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
        "video",
        "post",
        "audio",
        "image",
        "link",
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
        "author",
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
    publicKey: "binary",
    published: "timestamp",
    userId: "uuid",
    viewId: "integer",
  },
  tupleTypes: {
    Auth: ["authProvider", "authId", "userId", "created", "updated"],
    Content: ["contentId", "contentType", "title", "userId", "blobId", "content", "created", "updated", "published", "isPublic",
      { name: "url", type: "urlString" },
      { name: "mime_ext", type: "varchar(8)" },
      { name: "tags", type: "tag", multiValued: true },
      { name: "cryptHash", type: "varchar(200)" },
    ],
    Comment: ["commentId", "contentId", "userId", "comment", "created", "updated",
      { name: "parent", type: "commentId" },
    ],
    Invitation: ["ipAddress", "linkId", "created", "updated"],
    Link: ["linkId", "userId", "contentId", "title", "created", "updated", "comment",
      { name: "url", type: "urlString" },
      { name: "prevLink", type: "linkId" },
      { name: "tags", type: "tag", multiValued: true },
      { name: "amount", type: "integer" },
    ],
    Promotion: ["linkId", "userId", "created", "updated",
      { name: "delivered", type: "timestamp" }
    ],
    Tag: ["tag", "created"],
    User: ["userId", "publicKey", "userName", "email", "created", "updated",
      { name: "credits", type: "integer" },
      { name: "groups", type: "userGroup", multiValued: true }
    ],
    UserLink: [
      { name: "user_A", type: "userId" },
      { name: "user_B", type: "userId" },
      { name: "tags", type: "tag", multiValued: true },
      "created",
      "updated",
    ],
    View: ["viewId", "userId", "linkId", "created"],
    ContentView: ["viewId", "userId", "contentId", "linkId", "ipAddress", "created"],
  },
  tables: {   // the order of entries here is significant.  foreign keys can only reference preceding entries
    tags: {
      rowType: "Tag",
      primaryKey: ["tag"]
    },
    users: {
      rowType: "User",
      primaryKey: ["userId"],
      uniques: [["userName"]],
      updated: "updated",
    },
    userlinks: {
      rowType: "UserLink",
      primaryKey: ["user_A", "user_B"],
      foreignKeys: [
        { ref: "users", columns: ["user_A"] },
        { ref: "users", columns: ["user_B"] },
      ],
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
    contents: {
      rowType: "Content",
      primaryKey: ["contentId"],
      updated: "updated",
      foreignKeys: [
        { ref: "users", columns: ["userId"] },
      ],
      uniques: [["contentType", "title"]],
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