import { expect } from 'chai';

import { runWebpack, resolveWebpackConfig, configs, logWebpackStats } from './testing/utils';


describe('patch-ngtools-compiler-host-for-flat-module', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.
  
  const run = async (wpConfig) => {
    const stats = await runWebpack(resolveWebpackConfig(wpConfig)).done;
    logWebpackStats(stats);
    return stats;
  };


  it('should throw when trying to output with flatModule and no patch applied', async () => {

    const config = require(configs.pluginLib.wp)(true);
    const stats = await run(config);
    const compileErrors = stats['compilation'] && stats['compilation'].errors;

    expect(compileErrors).not.to.be.undefined;
    expect(compileErrors.length).to.eq(1);
    expect(compileErrors[0]).to.include(
      `TypeError: Cannot set property writeFile of #<WebpackCompilerHost> which has only a getter`,
      `No exception on flatModule without a patch, looks like https://github.com/angular/angular-cli/issues/8473 has been fixed.`
    );
  });

  it('should not throw when when trying to output with flatModule and a patch in place', async () => {
    const WebpackCompilerHost = require('@ngtools/webpack/src/compiler_host').WebpackCompilerHost;
    const writeFilePropertyDescriptor= Object.getOwnPropertyDescriptor(WebpackCompilerHost.prototype, 'writeFile');
    require('../src/patch-ngtools-compiler-host-for-flat-module');


    const config = require(configs.pluginLib.wp)(true);
    const stats = await run(config);
    const compileErrors = stats['compilation'] && stats['compilation'].errors;

    Object.defineProperty(WebpackCompilerHost.prototype, 'writeFile', writeFilePropertyDescriptor);

    expect(compileErrors.length).to.eq(0);
  });
});

