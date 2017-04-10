"use strict"
import * as Koa from 'koa';
import * as send from "koa-send";

export function serve(path, root): (cxt: Koa.Context, next: () => Promise<any>) => any {
  //path = path.replace(/^\/+/, "");

  return async function (ctx: Koa.Context, next: () => Promise<any>) {

    if (ctx.method == "GET" || ctx.method == "HEAD") {

      let req_path_array = ctx.path.slice(1).split("/");

      if (path == req_path_array[0]) {
        if (path.length > 0) {
          //req_path_array = req_path_array.slice(1);
          //await send(ctx, req_path_array.join("/"), { root });
          await send(ctx, req_path_array.join("/"));
          return;
        }
      }
    }
    next();
  }
};
