const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const tgtdir = process.env.NODE_ENV === 'development' ? 'dist/capuchin_dev' : 'dist/capuchin_rel'
const {capuchinVersion} = require('./dist/lib/utils');
const {TextEncoder, TextDecoder} = require('text-encoding');

module.exports = function (env) {
  return {
    entry: {
      main: './src/capuchin/main.tsx',
      background: './src/capuchin/background.ts'
    },
    output: {
      path: path.resolve(__dirname, tgtdir),
      filename: '[name].js'
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"]
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
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
    plugins: [
      new CopyWebpackPlugin([
        {
          from: 'src/capuchin/assets',
          transform: function(content, path) { 
            //console.log(content);
            var str = (new TextDecoder('utf-8')).decode(content);
            var rslt = str.replace("__CAPUCHIN_VERSION__", capuchinVersion()); 
            return (new TextEncoder()).encode(rslt);
          }
        }
      ]),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      }),
    ],
    devtool: 'inline-source-map'
  }
}