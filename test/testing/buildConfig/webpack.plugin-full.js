// THIS CONFIG RUNS THE PLUGIN WITH ADVANCED WEBPACK TOOLS (extract css, html plugin etc...)
const path = require('path');
const ngcWebpack = require('../../../dist/index');

const base = require('./base-webpack-config');

module.exports = function (aot, ngcWebpackUniqueOptions) {
  const config = base(aot);
  config.output.path = path.join(process.cwd(), `dist/test/ng-app-plugin-full`);
  config.plugins.unshift(
    new ngcWebpack.NgcWebpackPlugin(Object.assign({}, ngcWebpackUniqueOptions || {}, {
      skipCodeGeneration: !aot,
      tsConfigPath: './tsconfig.plugin-full.json',
      mainPath: 'test/ng-app/main.ts'
    }))
  );
  return config;
};
