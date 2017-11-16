import * as Path from 'path';
import * as rimraf from 'rimraf';
import { expect } from 'chai';

import { runWebpack, resolveWebpackConfig, configs, logWebpackStats } from './testing/utils';
import { runCli } from 'ngc-webpack';

const tsConfig = require(configs.pluginLib.ts);

function delOutDir() {
  if (tsConfig.compilerOptions.outDir) {
    // TODO: make sure outDir is not current dir
    const outDir = Path.resolve(configs.pluginLib.ts, tsConfig.compilerOptions.outDir);
    rimraf.sync(outDir);
  }
}



describe('ngc-webpack CLI', function() {
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

  it('CLI With flat module output', async () => {
    delOutDir();


    const config = require(configs.pluginLib.wp)(true);

    await runCli(config,[], { _: [] });
  });

});

