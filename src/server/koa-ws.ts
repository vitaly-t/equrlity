'use strict';

const url = require('url'),
  compose = require('koa-compose'),
  co = require('co'),
  ws = require('ws');
const wss = ws.Server;
const debug = require('debug')('koa:websockets');

const interval = setInterval(() => {
  let clients = ws.Server.clients;
  if (clients) {
    clients.forEach((sock) => {
      if (sock.isAlive === false) return sock.terminate();
      sock.isAlive = false;
      sock.ping('', false, true);
    });
  }
}, 30000);

function KoaWebSocketServer(app) {
  this.app = app;
  this.middleware = [];
}

KoaWebSocketServer.prototype.listen = function (server) {
  this.server = new wss({
    server: server
  });
  this.server.on('connection', this.onConnection.bind(this));
};

KoaWebSocketServer.prototype.onConnection = function (socket, req) {
  console.log('ws Connection received');
  socket.on('error', function (err) {
    debug('Error occurred:', err);
  });
  const fn = co.wrap(compose(this.middleware));

  const context = this.app.createContext(req);
  context.websocket = socket;
  console.log(socket.binaryType);
  socket.binaryType = 'arraybuffer';
  console.log(socket.binaryType);
  context.path = url.parse(req.url).pathname;

  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });
  socket.on('close', () => socket.isAlive = false);

  fn(context).catch(function (err) {
    debug(err);
  });
};

KoaWebSocketServer.prototype.use = function (fn) {
  this.middleware.push(fn);
  return this;
};

export default function (app) {
  const oldListen = app.listen;
  app.listen = function () {
    debug('Attaching server...');
    app.server = oldListen.apply(app, arguments);
    app.ws.listen(app.server);
    return app.server;
  };
  app.ws = new KoaWebSocketServer(app);
  return app;
};
