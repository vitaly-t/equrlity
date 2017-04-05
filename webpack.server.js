const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const tgtdir = './assets';
let outPath = path.resolve(__dirname, tgtdir);

module.exports = function (env) {
  return {
    entry: {
      media: './src/server/media.tsx',
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