const path = require('path');
const webpack = require('webpack');

const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');

const ngcWebpack = require('./dist/index');

module.exports = function () {

  return {
    devtool: 'cheap-module-source-map',

    entry: {
      'main':  './test/ng-app/main.browser.aot.ts'
    },

    output: {

      path: 'dist/test/ng-app',

      filename: '[name].bundle.js',

      sourceMapFilename: '[file].map',

      chunkFilename: '[id].chunk.js',

      library: 'ac_[name]',
      libraryTarget: 'var',
    },

    /*
     * Options affecting the resolving of modules.
     *
     * See: http://webpack.github.io/docs/configuration.html#resolve
     */
    resolve: {
      extensions: ['.ts', '.js'],
    },

    module: {
      rules: [

        /*
         * Typescript loader support for .ts and Angular 2 async routes via .async.ts
         * Replace templateUrl and stylesUrl with require()
         *
         * See: https://github.com/s-panferov/awesome-typescript-loader
         * See: https://github.com/TheLarkInn/angular2-template-loader
         */
        {
          test: /\.ts$/,
          use: [
            'awesome-typescript-loader?{configFileName: "tsconfig.integration.json"}',
            'angular2-template-loader',
            {
              loader: 'ng-router-loader',
              options: {
                loader: 'async-require',
                genDir: '__codegen__',
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
        tsConfig: path.resolve('./tsconfig.integration.json'),
        empty: path.resolve('./test/ng-app/empty.js')
      })
    ],

    /*
     * Include polyfills or mocks for various node stuff
     * Description: Node configuration
     *
     * See: https://webpack.github.io/docs/configuration.html#node
     */
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
