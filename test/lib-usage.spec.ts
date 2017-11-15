import { expect } from 'chai';

import { runWebpack, resolveWebpackConfig, configs, logWebpackStats, readFile, expectFileToMatch } from './testing/utils';
require('../src/patch-ngtools-compiler-host-for-flat-module');


describe('ngc-webpack library usage', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.
  
  const run = async (wpConfig) => {
    const stats = await runWebpack(resolveWebpackConfig(wpConfig)).done;
    logWebpackStats(stats);

    const compileErrors = stats['compilation'] && stats['compilation'].errors;
    if (compileErrors) {
      expect(compileErrors.length).to.be
        .lt(1, `Expected no TypeScript errors, found ${compileErrors.length}\n` + compileErrors.map(e => (e.message || e) + '\n'));
    }
    return stats.toJson().assets;
  };

  it('should replace the path for a resource', async () => {

    const config = require(configs.pluginLib.wp)(true);
    await run(config);
  });

});

