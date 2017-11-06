process.env.NODE_ENV = 'production';
require('ts-node/register');
const Path = require('path');

const tUtils = require('./test/testing/utils');

const configs = [
  'pluginFull',
  'ngToolsFull'
];

const run = async (wpConfig) => {
  const stats = await tUtils.runWebpack(tUtils.resolveWebpackConfig(wpConfig)).done;
  tUtils.logWebpackStats(stats);

  const compileErrors = stats['compilation'] && stats['compilation'].errors;
  if (compileErrors) {
    compileErrors.forEach(e => console.error(e) );
  }
};

// EDIT HERE TO REPLACE CONFIG
const IDX = 0;
const config = tUtils.configs[configs[IDX]];

const ngcOptions = {

};
run(require(config.wp)(true, ngcOptions)).catch( err => console.log(err) );


