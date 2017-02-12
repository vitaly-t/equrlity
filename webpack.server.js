'use strict';

/** 
 * @@GS. NB - this file is not currently used, as I was unable to make pg-promise play ball nicely with webpack.
 * If and when we can get that fixed we should revert to building the server with webpack.
 * The current system of file copying (see scripts/cp2heroku.ps1) blows big-time.
 * 
 */

const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  cache: true,
  entry: {
    server: "./src/server/server.ts",
  },
  output: {
    path: "../amplitude_heroku",
    filename: "server.js",
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      },
      {
        enforce: 'pre',
        test: /\.js$/,
        loader: "source-map-loader"
      }
    ]
  },
  performance: {
    hints: false
  },

  target: 'node',
  plugins: [
    new CopyWebpackPlugin([
      { from: 'server/assets', to: '../amplitude_heroku/assets' }
    ]),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': "production"
    }),
  ]

}



