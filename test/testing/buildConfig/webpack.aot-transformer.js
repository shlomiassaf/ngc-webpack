const path = require('path');
const AotPlugin = require('@ngtools/webpack').AotPlugin;

module.exports = { /* ... */
  entry: {
    'main':  './test/aot-cleanup-transformer/module.ts'
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'awesome-typescript-loader',
            options: {
              configFileName: 'tsconfig.aot-transformer.json'
            }
          },
          {
            loader: path.join(process.cwd(), `test/testing/aot-cleanup-test-utils.ts`)
          }
        ]

      }
    ]
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  output: {

    path: path.join(process.cwd(), `dist/test/aot-transformer`),

    filename: '[name].bundle.js',

    sourceMapFilename: '[file].map',

    chunkFilename: '[id].chunk.js',

    library: 'ac_[name]',
    libraryTarget: 'var',
  },

  plugins: [
    new AotPlugin({
      tsConfigPath: './tsconfig.aot-transformer.json',
      entryModule: 'test/aot-cleanup-transformer/module#AppModule'
    })
  ]
};
