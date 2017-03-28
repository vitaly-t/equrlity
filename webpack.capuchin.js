const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const tgtdir = process.env.NODE_ENV === 'development' ? 'dist/capuchin_dev' : 'dist/capuchin_rel';
const google_id = process.env.GOOGLE_ID;
const { capuchinVersion } = require('./dist/lib/utils');
const { TextEncoder, TextDecoder } = require('text-encoding');
let outPath = path.resolve(__dirname, tgtdir);

module.exports = function (env) {
  return {
    entry: {
      main: './src/capuchin/main.tsx',
      background: './src/capuchin/background.ts',
      settings: './src/capuchin/settings.tsx',
      post: './src/capuchin/postEditor.tsx',
    },
    output: {
      path: outPath,
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
            if (path.endsWith('manifest.json')) {
              console.log("transforming: " + path);
              var str = (new TextDecoder('utf-8')).decode(content);
              str = str.replace("__CAPUCHIN_VERSION__", capuchinVersion());
              //str = str.replace("__GOOGLE_ID__", google_id);
              return (new TextEncoder()).encode(str);
            }
            return content;
          }
        },
        {
          from: 'node_modules/@blueprintjs/core/dist/*.css',
          to: outPath
        },
        {
          context: path.resolve(__dirname, 'node_modules/@blueprintjs/core/resources'),
          from: '**/*',
          to: path.resolve(outPath, 'node_modules/@blueprintjs/core/resources/')
        },
      ], { copyUnmodified: true }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      }),
    ],
    devtool: 'inline-source-map'
  }
}