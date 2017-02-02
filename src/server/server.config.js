'use strict';

const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

module.exports = {
  context: __dirname + "/server",
  cache: true,
  entry: {
    app: "./server.js",
  },
  output: {
    path: __dirname + "/dist",
    filename: "amplitude_bundl.js",
    publicPath: "/assets",
  },
  devServer: {
    contentBase: __dirname + "/src"
  },
  devtool: "source-map",
  module: {
    rules: [ { test: /\.json$/, loader: 'json-loader' } ],
    preLoaders: [
      { test: /\.js$/, loader: "source-map-loader" }
    ]

  },
  resolve: {
    extensions: ['', '.js', '.ts'],
  },
  node: {
    fs: "empty"
  }

}



