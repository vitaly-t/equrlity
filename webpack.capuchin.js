const fs = require('fs');
const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const isDev = process.env.NODE_ENV === 'development';
const tgtdir = isDev ? 'dist/capuchin_dev' : 'dist/capuchin_rel';
const { capuchinVersion } = require('./dist/lib/utils');
const { TextEncoder, TextDecoder } = require('text-encoding');
let outPath = path.resolve(__dirname, tgtdir);

function htmlPage(pg) {
  return `
<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <link href="./node_modules/@blueprintjs/core/dist/blueprint.css" rel="stylesheet" />
    <link href="./node_modules/react-select/dist/react-select.css" rel="stylesheet" />
    <link href="./node_modules/react-simple-flex-grid/lib/main.css" rel="stylesheet" />
</head>

<body>
    <script type="text/javascript" src="${pg}_bndl.js"></script>
    <div id="app"></div>
</body>

</html>`;
}

let entry = {
  main: './src/capuchin/main.tsx',
  background: './src/capuchin/background.ts',
}
for (const pg of ['settings', 'contents', 'links']) {
  entry[pg] = `./src/capuchin/${pg}.tsx`;
  fs.writeFileSync(outPath + '/' + pg + '.html', htmlPage(pg));
}

module.exports = function (env) {
  return {
    entry,
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
              //if (!isDev) { str = str.replace(/\"key\".+$/gm, ""); }
              return (new TextEncoder()).encode(str);
            }
            return content;
          }
        },
        {
          from: 'node_modules/react-select/dist/*.css',
          to: outPath
        },
        {
          from: 'node_modules/react-simple-flex-grid/lib/*.css',
          to: outPath
        },
        {
          from: 'node_modules/@blueprintjs/core/dist/*.css',
          to: outPath
        },
        {
          from: 'node_modules/video.js/dist/*.css',
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