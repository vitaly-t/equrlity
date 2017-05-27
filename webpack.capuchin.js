const fs = require('fs');
const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { capuchinVersion } = require('./dist/lib/utils');
const { TextEncoder, TextDecoder } = require('text-encoding');

const isDev = process.env.NODE_ENV === 'development';
const tgtdir = isDev ? 'dist' : 'dist/rel';
let outDir = path.resolve(__dirname, tgtdir);
let outPath = outDir + '/capuchin';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
if (!fs.existsSync(outPath)) fs.mkdirSync(outPath);

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

let authEntries = isDev ? '' :
  `"key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm6d6YAsux6DwZwsrlp3e/V+2EdbSLxidSNNn6w4Crrf1WqwR//BeouiWTjdNpKGkEGJ4KltUkIy9hSUxpkhAKSooNlRwu+nOOOrgGezorZ/kL0rv547euZ0g8UpdcnN4Wpf1Fv8TbzODWdZ5kU1wO5sNPZX4uhSjcQSU/vm/6QYJw4m0r4VMEO31mYzx7nXyRB8GLqqwaLw9e4z+RlqKC+42gRlE34NWjUdxOSAa3QIAc/yz652jwhdchowMqmPazIwgUPO+rkkXudHPh99MClER/51O9saFWI+ZKjhyQPefM2iy5vT2dokpuwdJVnr9bqVh2jaerE9Y8Nwi/NK3UQIDAQAB",
  "oauth2": {
    "client_id": "23837795632-i1o9fs39uh43132jb10gqcvjl4h006cd.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/plus.login"
    ]
  },`;

let icon32 = isDev ? "pseudoq2.png" : "pseudoq_rel_32.png";
let icon128 = isDev ? "pseudoq2.png" : "pseudoq_rel_128.png";

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
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
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
              str = str.replace('"auth_entries": "",', authEntries);
              str = str.replace('__ICON_32__', icon32);
              str = str.replace('__ICON_128__', icon128);
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