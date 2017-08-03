// THIS CONFIG RUNS THE PLUGIN WITH ADVANCED WEBPACK TOOLS (extract css, html plugin etc...)
const path = require('path');
const webpack = require('webpack');

const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ngcWebpack = require('../../../dist/index');

/**
 *
 * @param aotCleanup loader or transformer (defaults to loader)
 */
module.exports = function (aotCleanup) {

  if (!aotCleanup) aotCleanup = 'loader';
  const tsRule = {
    test: /\.ts$/,
    use: [
      {
        loader: 'ng-router-loader',
        options: {
          loader: 'async-import',
          genDir: 'dist/test/codegen_plugin-full',
          aot: true
        }
      },
      {
        loader: 'awesome-typescript-loader',
        options: {
          configFileName: 'tsconfig.plugin-full.json'
        }
      },
      'angular2-template-loader'
    ],
    exclude: [/\.(spec|e2e)\.ts$/]
  };

  if (aotCleanup === 'loader') {
    const templateLoader = tsRule.use.pop();
    tsRule.use.push({
      loader: path.join(process.cwd(), `dist/index.js`),
      options: {
        disable: false
      }
    });
    tsRule.use.push(templateLoader);
  } else if (aotCleanup === 'transformer') {
    tsRule.use[1].options.getCustomTransformers = () => ({
      before: [ ngcWebpack.aotCleanupTransformer ],
      after: []
    });
  }

  return {
    devtool: false,

    entry: {
      'main':  './test/ng-app/main.browser.aot.plugin-full.ts'
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
        tsRule,
        {
          test: /\.html$/,
          use: 'html-loader'
        },

        {
          test: /\.(css|scss)/,
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
      new CheckerPlugin(),
      new webpack.ContextReplacementPlugin(
        // The (\\|\/) piece accounts for path separators in *nix and Windows
        /angular(\\|\/)core(\\|\/)@angular/,
        'test'
      ),
      new LoaderOptionsPlugin({}),
      new ExtractTextPlugin("bundle.css"),
      new HtmlWebpackPlugin({
        template: './test/ng-app/index.html',
        inject: true,
        filename: "index.html",
      }),
      new ngcWebpack.NgcWebpackPlugin({
        disabled: false,
        tsConfig: path.resolve('tsconfig.plugin-full.json')
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
