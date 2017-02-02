/**
 * Module dependencies.
 */
import dbg from 'debug';
const debug = dbg('koa-send');
import resolvePath from 'resolve-path';
import * as assert from 'assert';
import * as path from 'path';
const normalize = path.normalize;
const basename = path.basename;
const extname = path.extname;
const resolve = path.resolve;
const parse = path.parse;
const sep = path.sep;

import * as fs from 'fs';
import {promisify} from '../lib/promisify';

const statAsync = promisify(fs.stat);

export default async function send(ctx, path, opts: any = {}) {
    assert(ctx, 'koa context required');
    assert(ctx.path, 'pathname required');

    // options
    debug('send "%s" %j', path, opts);
    const root = opts.root ? normalize(resolve(opts.root)) : '';
    const trailingSlash = '/' == path[path.length - 1];
    path = path.substr(parse(path).root.length);
    const index = opts.index;
    const maxage = opts.maxage || opts.maxAge || 0;
    const hidden = opts.hidden || false;
    const format = opts.format === false ? false : true;
    const gzip = opts.gzip === false ? false : true;

    const encoding = ctx.acceptsEncodings('gzip', 'deflate', 'identity');

    // normalize path
    path = decode(path);

    if (-1 == path) return ctx.throw('failed to decode', 400);

    // index file support
    if (index && trailingSlash) path += index;

    path = resolvePath(root, path);


    // hidden file support, ignore
    if (!hidden && isHidden(root, path)) return null;

    //console.log('send "%s" %j', path, opts);
    //serve gzipped file when possible
    //if (encoding === 'gzip' && gzip && (yield fs.existsAsync(path + '.gz'))) {
    //  path = path + '.gz';
    //  ctx.set('Content-Encoding', 'gzip');
    //  ctx.res.removeHeader('Content-Length');
    //}

    let stats: any = undefined;
    try {
      stats = await statAsync(path);

      // Format the path to serve static file servers
      // and not require a trailing slash for directories,
      // so that you can do both `/directory` and `/directory/`
      if (stats.isDirectory()) {
        if (format && index) {
          path += '/' + index;
          stats = await statAsync(path);
        } else {
          return;
        }
      }
    } catch (err) {
      const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];
      if (~notfound.indexOf(err.code)) return;
      err.status = 500;
      throw err;
    }

    // stream
    ctx.set('Last-Modified', stats.mtime.toUTCString());
    ctx.set('Content-Length', stats.size);
    ctx.set('Cache-Control', 'max-age=' + (maxage / 1000 | 0));
    ctx.type = type(path);
    ctx.body = fs.createReadStream(path);

    return path;
};

/**
 * Check if it's hidden.
 */

function isHidden(root, path) {
  path = path.substr(root.length).split(sep);
  for(var i = 0; i < path.length; i++) {
    if(path[i][0] === '.') return true;
  }
  return false;
}

/**
 * File type.
 */

function type(file) {
  return extname(basename(file, '.gz'));
}

/**
 * Decode `path`.
 */

function decode(path) {
  try {
    return decodeURIComponent(path);
  } catch (err) {
    return -1;
  }
}
