import * as Path from 'path';
import * as rimraf from 'rimraf';
import { expect } from 'chai';

import { ModuleMetadata } from '@angular/compiler-cli';
import { runWebpack, resolveWebpackConfig, configs, logWebpackStats, readFile, writeFile } from './testing/utils';

import { NgcWebpackPlugin as _NgcWebpackPlugin } from '../index';
import { findPluginIndex as _findPluginIndex } from '../src/cli/cli';

let NgcWebpackPlugin: typeof _NgcWebpackPlugin;
let findPluginIndex: typeof _findPluginIndex;

const tsConfig = require(configs.pluginLib.ts);
const outDir = Path.resolve(Path.dirname(configs.pluginLib.ts), tsConfig.compilerOptions.outDir || '.');

function delOutDir() {
  const root = Path.resolve(Path.dirname(configs.pluginLib.ts), '.');
  const cwd = process.cwd();
  if (outDir.length > root.length && outDir.length > cwd.length) {
    rimraf.sync(outDir);
  }
}

async function createTempTsConfig(transform: ((config) => any) = cfg => cfg): Promise<string> {
  const tmpTsConfig = configs.pluginLib.ts.replace(/\.json$/, '.tmp.json');
  const cfg = JSON.parse(await readFile(configs.pluginLib.ts));
  await writeFile(tmpTsConfig, JSON.stringify(transform(cfg)));
  return tmpTsConfig;
}

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

  it('should run with library config', async () => {
    const WebpackCompilerHost = require('@ngtools/webpack/src/compiler_host').WebpackCompilerHost;
    const writeFilePropertyDescriptor = Object.getOwnPropertyDescriptor(WebpackCompilerHost.prototype, 'writeFile');

    try {
      NgcWebpackPlugin = require('../dist').NgcWebpackPlugin;
      findPluginIndex = require('../dist/src/cli/cli').findPluginIndex;
      require('../dist/src/patch-ngtools-compiler-host-for-flat-module');
    } catch (e) {
      NgcWebpackPlugin = require('../index').NgcWebpackPlugin;
      findPluginIndex = require('../src/cli/cli').findPluginIndex;
      require('../src/patch-ngtools-compiler-host-for-flat-module');
    }

    delOutDir();

    const tmpTsConfig = await createTempTsConfig( config => {
      return Object.assign(config, {
        angularCompilerOptions: {
          annotateForClosureCompiler: true,
          skipMetadataEmit: false,
          skipTemplateCodegen: false,
          fullTemplateTypeCheck: true,
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

    await run(config);

    Object.defineProperty(WebpackCompilerHost.prototype, 'writeFile', writeFilePropertyDescriptor);

    rimraf.sync(tmpTsConfig);

    // the directory of index.ts:
    const root = Path.dirname(Path.resolve(Path.dirname(configs.pluginLib.ts), tsConfig.files[0]));
    const metadataJsonPath = Path.resolve(root, 'my-lib.ng-flat.metadata.json');
    const meta = await readFile(metadataJsonPath);
    rimraf.sync(metadataJsonPath);

    const metadataBundle: ModuleMetadata = JSON.parse(meta);
    const LibComponentComponent: any = metadataBundle.metadata.LibComponentComponent;

    // flat module with @ngtools/webpack doesn't inline resources into metadata
    expect(LibComponentComponent.decorators[0].arguments[0]).to.eql({
      "selector": "lib-component",
      "templateUrl": "./lib-component.component.html",
      "styleUrls": [
        "./lib-component.component.scss"
      ]
    });


  });

});

