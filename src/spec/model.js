export default {
  "scalarTypes": {
    "authId": {
      "sqlType": "varchar(128)"
    },
    "boolean": {
       "tsType": "boolean",
       "sqlType": "boolean"
    },
    "date": {
      "tsType": "Date",
      "sqlType": "date"
    },
    "gameType": {
      "sqlType": "varchar(10)",
      "enum": [
        "Killer",
        "Ninja",
        "Samurai",
        "Assassin",
        "Hidato"
      ]
    },
    "integer": {
       "tsType": "number",
       "sqlType": "integer"
    },
    "json": {
      "sqlType": "jsonb"
    },
    "percentage": {
      "tsType": "number",
      "sqlType": "integer",
      "max": 100,
      "min": 0
    },
    "puzzleId": {
      "tsType": "number",
      "sqlType": "integer"
    },
    "rating": {
      "tsType": "number",
      "sqlType": "integer"
    },
    "solnId": {
      "tsType": "number",
      "sqlType": "integer"
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
      "sqlType": "varchar(36)"
    },
    "userName": {
      "sqlType": "varchar(36)"
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
    "Puzzle": [
      "puzzleId",
      "gameType",
      {
        "name": "pubday",
        "type": "date"
      },
      "rating",
      {
        "name": "layout",
        "type": "json"
      }
    ],
    "PuzzlesForDay": [
      "date",
      {
        "name": "pos",
        "type": "integer"
      },
      {
        "name": "puzzle",
        "type": "puzzleId"
      },
      {
        "name": "id",
        "type": "integer"
      }
    ],
    "Solution": [
      "solnId",
      {
        "name": "puzzle",
        "type": "puzzleId"
      },
      {
        "name": "user",
        "type": "userId"
      },
      {
        "name": "lastPlay",
        "type": "timestamp"
      },
      {
        "name": "completed",
        "type": "boolean"
      },
      {
        "name": "moveCount",
        "type": "integer"
      },
      {
        "name": "doc",
        "type": "json"
      },
      {
        "name": "percentCompleted",
        "type": "percentage"
      },
      {
        "name": "secondsElapsed",
        "type": "integer"
      }
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
      {"name": "groups", "type": "userGroup", "multiValued": true }
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
    "days": {
      "rowType": "PuzzlesForDay",
      "primaryKey": [
        "id"
      ],
      "foreignKeys": [
        {
          "ref": "puzzles",
          "columns": "puzzle"
        }
      ],
      "autoIncrement": "id",
      "uniques": [
        [
          "puzzle"
        ],
        [
          "date",
          "pos"
        ]
      ]
    },
    "puzzles": {
      "rowType": "Puzzle",
      "primaryKey": [
        "puzzleId"
      ]
    },
    "solutions": {
      "rowType": "Solution",
      "primaryKey": [
        "solnId"
      ],
      "autoIncrement": "solnId",
      "foreignKeys": [
        {
          "ref": "users",
          "columns": [
            "user"
          ]
        }
      ],
      "uniques": [
        [
          "user",
          "puzzle"
        ]
      ]
    },
    "users": {
      "rowType": "User",
      "primaryKey": [
        "userId"
      ]
    }
  }
}