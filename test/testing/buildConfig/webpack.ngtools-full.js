// THIS CONFIG RUNS THE NGTOOLS AOT WITH ADVANCED WEBPACK TOOLS (extract css, html plugin etc...)
const path = require('path');
const webpack = require('webpack');

const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ngToolsWebpack = require('@ngtools/webpack');

module.exports = function () {

  return {
    devtool: false,

    entry: {
      'main':  'test/ng-app/main.browser.ts'
    },

    output: {

      path: path.join(process.cwd(), `dist/test/ng-app-ngtools-full`),

      filename: '[name].bundle.js',

      sourceMapFilename: '[file].map',

      chunkFilename: '[id].chunk.js',

      library: 'ac_[name]',
      libraryTarget: 'var',
    },

    resolve: {
      extensions: ['.ts', '.js'],
    },

    resolveLoader: {
      modules: ["src", "node_modules"],
      extensions: ['.ts', '.js'],
    },

    module: {
      rules: [
        { test: /.ts$/, use: '@ngtools/webpack' },
        {
          test: /\.html$/,
          use: 'html-loader'
        },

        {
          test: /\.(css|scss)$/,
          exclude: /styles\/.+\.(css|scss)$/,
          use: ['to-string-loader', 'css-loader', 'sass-loader'],
        },
        {
          test: /styles\/.+\.(css|scss)$/,
          loader: ExtractTextPlugin.extract({
            use: ['css-loader', 'sass-loader'],
          })
        },
        {test: /\.(png|ico|gif)$/, loader: "file-loader?name=bundle.[name].[ext]"}
      ]
    },

    plugins: [
      new LoaderOptionsPlugin({}),
      new ExtractTextPlugin("bundle.css"),
      new HtmlWebpackPlugin({
        template: 'test/ng-app/index.html',
        inject: true,
        filename: "index.html",
      }),
      new ngToolsWebpack.AotPlugin({
        tsConfigPath: './tsconfig.ngtools-full.json',
        entryModule: 'test/ng-app/app/app.module#AppModule'
      }),
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
