"use strict"

import * as send from "koa-send";

export default function serve(path, root) {
  path = path.replace(/^\/+/, "");

  return async function (ctx, next) {
    if (ctx.method == "GET" || ctx.method == "HEAD") {

      let req_path_array = ctx.path.slice(1).split("/");

      if (path == req_path_array[0]) {
        if (path.length > 0) {
          //req_path_array = req_path_array.slice(1);
          //await send(ctx, req_path_array.join("/"), { root });
          await send(ctx, req_path_array.join("/"));
          return next();
        }
      }
    }
    return next();
  }
};
