const path = require('path');
const webpack = require('webpack');

const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');

const ngcWebpack = require('../../../dist/index');

module.exports = function () {

  return {
    devtool: 'cheap-module-source-map',

    entry: {
      'main':  './test/ng-app/main.browser.aot.plugin.ts'
    },

    output: {

      path: `dist/test/ng-app-plugin`,

      filename: '[name].bundle.js',

      sourceMapFilename: '[file].map',

      chunkFilename: '[id].chunk.js',

      library: 'ac_[name]',
      libraryTarget: 'var',
    },

    resolve: {
      extensions: ['.ts', '.js'],
    },

    module: {
      rules: [

        {
          test: /\.ts$/,
          use: [
            `awesome-typescript-loader?{configFileName: "tsconfig.plugin.json"}`,
            'angular2-template-loader',
            {
              loader: 'ng-router-loader',
              options: {
                loader: 'async-require',
                genDir: 'dist/test/codegen_plugin',
                aot: true
              }
            }
          ],
          exclude: [/\.(spec|e2e)\.ts$/]
        },

        {
          test: /\.html$/,
          use: 'raw-loader'
        },

        /*
         * to string and css loader support for *.css files (from Angular components)
         * Returns file content as string
         *
         */
        {
          test: /\.css$/,
          use: ['to-string-loader', 'css-loader']
        },

        /*
         * to string and sass loader support for *.scss files (from Angular components)
         * Returns compiled css content as string
         *
         */
        {
          test: /\.scss$/,
          use: ['to-string-loader', 'css-loader', 'sass-loader']
        }
      ]
    },

    plugins: [
      new CheckerPlugin(),
      new LoaderOptionsPlugin({}),
      new ngcWebpack.NgcWebpackPlugin({
        tsConfig: path.resolve('tsconfig.plugin.json'),
        pathTransformer: (p) => p.endsWith('app.component.css') ? path.resolve('test/testing/replaced-resource.scss') : p,
        sourceTransformer: (p, s) => p.endsWith('home.component.html') ? 'HTML WAS HIJACKED BY A TEST!!!' : s,
        resourceOverride: path.resolve('test/ng-app/empty.js')
      })
    ],

    node: {
      global: true,
      crypto: 'empty',
      process: true,
      module: false,
      clearImmediate: false,
      setImmediate: false
    }

  };
};
