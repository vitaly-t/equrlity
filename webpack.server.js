const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

let nodeEnv = process.env.NODE_ENV;
const tgtdir = nodeEnv === 'development' ? 'dist' : nodeEnv === 'staging' ? 'dist/staging' : 'dist/rel';
let outPath = path.resolve(__dirname, tgtdir);
if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);

module.exports = function () {
  return {
    entry: {
      media: './src/bundles/media.tsx',
      homepage: './src/bundles/homepage.tsx',
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
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': `"${nodeEnv}"`
      }),
    ],
    devtool: 'inline-source-map'
  }
}