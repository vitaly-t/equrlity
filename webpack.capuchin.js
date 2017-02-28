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
      background: './src/capuchin/background.ts',
      settings: './src/capuchin/settings.tsx',
      post: './src/capuchin/post.tsx',
    },
    output: {
      path: path.resolve(__dirname, tgtdir),
      filename: '[name]_bndl.js'
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
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(ttf|eot|woff)$/,
          loader: 'file-loader'        
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
          transform: function (content, path) {
            //console.log(content);
            var str = (new TextDecoder('utf-8')).decode(content);
            var rslt = str.replace("__CAPUCHIN_VERSION__", capuchinVersion());
            return (new TextEncoder()).encode(rslt);
          }
        },
        {
          from: 'assets/*.css',
        }
      ]),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      }),
    ],
    devtool: 'inline-source-map'
  }
}