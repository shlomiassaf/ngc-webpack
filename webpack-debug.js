var webpack = require("webpack");

process.env.NODE_ENV = 'production';

var webpackConfig = require('./webpack.integration');


function compilerCallback(err, stats) {
  if (err) throw err;
}

var compiler = webpack(webpackConfig()); // load webpack

compiler.run(compilerCallback);