// THIS CONFIG RUNS THE NGTOOLS AOT WITH ADVANCED WEBPACK TOOLS (extract css, html plugin etc...)
const path = require('path');
const ngToolsWebpack = require('@ngtools/webpack');

const base = require('./base-webpack-config');

module.exports = function (aot) {
  const config = base(aot);
  config.output.path = path.join(process.cwd(), `dist/test/ng-app-ngtools-full`);
  config.plugins.unshift(
    new ngToolsWebpack.AngularCompilerPlugin({
      skipCodeGeneration: !aot,
      tsConfigPath: './tsconfig.ngtools-full.json',
      mainPath: 'test/ng-app/main.ts'
    })
  );
  return config;
};
