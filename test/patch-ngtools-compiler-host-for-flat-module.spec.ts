import { expect } from 'chai';

import { runWebpack, resolveWebpackConfig, configs, logWebpackStats, readFile, writeFile } from './testing/utils';
import { NgcWebpackPlugin as _NgcWebpackPlugin } from '../index';
import { findPluginIndex as _findPluginIndex } from '../src/cli/cli';

let NgcWebpackPlugin: typeof _NgcWebpackPlugin;
let findPluginIndex: typeof _findPluginIndex;
try {
  NgcWebpackPlugin = require('../dist').NgcWebpackPlugin;
  findPluginIndex = require('../dist/src/cli/cli').findPluginIndex;
} catch (e) {
  NgcWebpackPlugin = require('../index').NgcWebpackPlugin;
  findPluginIndex = require('../src/cli/cli').findPluginIndex;
}


async function createTempTsConfig(transform: ((config) => any) = cfg => cfg): Promise<string> {
  const tmpTsConfig = configs.pluginLib.ts.replace(/\.json$/, '.tmp.json');
  const cfg = JSON.parse(await readFile(configs.pluginLib.ts));
  await writeFile(tmpTsConfig, JSON.stringify(transform(cfg)));
  return tmpTsConfig;
}

describe('patch-ngtools-compiler-host-for-flat-module', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.
  
  const run = async (wpConfig) => {
    const stats = await runWebpack(resolveWebpackConfig(wpConfig)).done;
    logWebpackStats(stats);
    return stats;
  };


  it('should throw when trying to output with flatModule and no patch applied', async () => {

    const tmpTsConfig = await createTempTsConfig( config => {
      return Object.assign(config, {
        angularCompilerOptions: {
          annotateForClosureCompiler: true,
          skipMetadataEmit: false,
          skipTemplateCodegen: true,
          strictMetadataEmit: true,
          flatModuleOutFile: 'my-lib.ng-flat.js',
          flatModuleId: 'my-lib'
        }
      });
    });

    const config = require(configs.pluginLib.wp)(true);
    const pluginIdx = findPluginIndex(config.plugins);
    const options = {
      skipCodeGeneration: false,
      tsConfigPath: tmpTsConfig
    };

    const plugin = NgcWebpackPlugin.clone(config.plugins[pluginIdx], { options });
    config.plugins.splice(pluginIdx, 1, plugin);

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
    const writeFilePropertyDescriptor = Object.getOwnPropertyDescriptor(WebpackCompilerHost.prototype, 'writeFile');

    try {
      require('../dist/patch-ngtools-compiler-host-for-flat-module');
    } catch (e) {
      require('../src/patch-ngtools-compiler-host-for-flat-module');
    }

    const config = require(configs.pluginLib.wp)(true);
    const stats = await run(config);
    const compileErrors = stats['compilation'] && stats['compilation'].errors;

    Object.defineProperty(WebpackCompilerHost.prototype, 'writeFile', writeFilePropertyDescriptor);

    expect(compileErrors.length).to.eq(0);
  });
});

