// THIS CONFIG RUNS THE PLUGIN WITH ADVANCED WEBPACK TOOLS (extract css, html plugin etc...)
const path = require('path');
const webpack = require('webpack');

const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ngcWebpack = require('../../../dist/index');
const PurifyPlugin = require('@angular-devkit/build-optimizer').PurifyPlugin;

module.exports = function (aot, ngcWebpackUniqueOptions) {

  const tsLoader = {
    test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
    use: [ '@ngtools/webpack' ]
  };

  if (aot) {
    tsLoader.use.unshift({
      loader: '@angular-devkit/build-optimizer/webpack-loader',
      options: {
        // sourceMap: ?
      }
    });
  }

  return {
    entry: {
      'main':  'test/ng-app/main.ts'
    },

    output: {

      path: path.join(process.cwd(), `dist/test/ng-app-plugin-full`),

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
        tsLoader,
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
      new webpack.SourceMapDevToolPlugin({
        filename: '[file].map[query]',
        moduleFilenameTemplate: '[resource-path]',
        fallbackModuleFilenameTemplate: '[resource-path]?[hash]',
        sourceRoot: 'webpack:///'
      }),
      new ExtractTextPlugin("bundle.css"),
      new HtmlWebpackPlugin({
        template: './test/ng-app/index.html',
        inject: true,
        filename: "index.html",
      }),
      new PurifyPlugin(),
      new webpack.optimize.CommonsChunkPlugin({
        minChunks: Infinity,
        name: 'inline'
      }),
      new webpack.optimize.CommonsChunkPlugin({
        name: 'main',
        async: 'common',
        children: true,
        minChunks: 2
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
