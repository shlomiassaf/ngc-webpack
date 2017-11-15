// THIS CONFIG RUNS THE PLUGIN WITH ADVANCED WEBPACK TOOLS (extract css, html plugin etc...)
const path = require('path');
const ngcWebpack = require('../../../dist/index');
const PurifyPlugin = require('@angular-devkit/build-optimizer').PurifyPlugin;

module.exports = function (aot, ngcWebpackUniqueOptions) {
    return {
        entry: 'test/ng-lib/src/index.ts',

        externals: [
            /^@angular\//,
            /^rxjs$/,
            /^rxjs\/.+/,
        ],

        output: {
            path: path.join(process.cwd(), `dist/test/ng-lib-plugin/bundle`),
            filename: '[name].bundle.webpack.umd.js',
            libraryTarget: 'umd',
            library: 'ng-lib'
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
                {
                    test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
                    use: [ '@ngtools/webpack' ]
                },
                {
                    test: /\.html$/,
                    use: 'html-loader'
                },

                {
                    test: /\.(css|scss)$/,
                    exclude: /styles\/.+\.(css|scss)$/,
                    use: ['to-string-loader', 'css-loader', 'sass-loader'],
                },
                {test: /\.(png|ico|gif)$/, loader: "file-loader?name=bundle.[name].[ext]"}
            ]
        },

        plugins: [
            new ngcWebpack.NgcWebpackPlugin(Object.assign({}, ngcWebpackUniqueOptions || {}, {
                skipCodeGeneration: !aot,
                tsConfigPath: './tsconfig.plugin-lib.json',
                mainPath: 'test/ng-lib/src/index.ts',
                // we must pass an entry module because the main path has not bootstrap that compiler can detect.
                entryModule: 'test/ng-lib/src/lib-module.module.ts'
            })),
            new PurifyPlugin(),
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
