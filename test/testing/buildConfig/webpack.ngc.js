const path = require('path');
const webpack = require('webpack');

const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');

module.exports = function () {

  return {
    devtool: 'cheap-module-source-map',

    entry: {
      'main':  './test/ng-app/main.browser.aot.ngc.ts'
    },

    output: {

      path: path.join(process.cwd(), `dist/test/ng-app-ngc`),

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
            {
              loader: 'ng-router-loader',
              options: {
                loader: 'async-import',
                genDir: 'dist/test/codegen_ngc',
                aot: true
              }
            },
            {
              loader: 'awesome-typescript-loader',
              options: {
                configFileName: 'tsconfig.ngc.json'
              }
            },
            'angular2-template-loader',
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
        },
        {test: /\.(png|ico|gif)$/, loader: "file-loader?name=bundle.[name].[ext]"}
      ]
    },

    plugins: [
      new CheckerPlugin(),
      new LoaderOptionsPlugin({})
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
