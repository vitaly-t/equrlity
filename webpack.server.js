const webpack = require('webpack');
const path = require('path');
const tgtdir = process.env.NODE_ENV === 'development' ? 'dist' : 'dist/bundles_rel';
let outPath = path.resolve(__dirname, tgtdir);

module.exports = function (env) {
  return {
    entry: {
      media: './src/bundles/media.tsx',
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
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      }),
    ],
    devtool: 'inline-source-map'
  }
}