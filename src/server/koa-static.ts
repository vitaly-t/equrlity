"use strict";

import {resolve} from 'path'; 
import * as assert from 'assert';
import dbg from 'debug';
const debug = dbg('koa-static');
import send from './koa-send';
import {isDev} from '../lib/utils';


export default function serve(root, opts: any = {}): (ctx: any, opts: any) => void {

  assert(root, 'root directory is required to serve files');
  let dflt = isDev() ? "default.html" : "index.html";

  // options
  debug('static "%s" %j', root, opts);
  opts.root = resolve(root);
  opts.index = opts.index || dflt;

  if (!opts.defer) {
    return async function serve(cxt, next){
      if (cxt.method == 'HEAD' || cxt.method == 'GET') {
        console.log('static serving : '+cxt.path);
        await send(cxt, cxt.path, opts);
      }
      if (next) await next();
    };
  }

  return async function serve(cxt, next){
    if (next) await next();
    if (cxt.method != 'HEAD' && cxt.method != 'GET') return;
    // response is already handled
    if (cxt.body || cxt.status != 404) return;
    //console.log('static serving : '+cxt.path);
    return await send(cxt, cxt.path, opts);
  };
}
