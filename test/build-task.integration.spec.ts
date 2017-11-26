import * as Path from 'path';
import * as FS from 'fs';
import * as rimraf from 'rimraf';
import { expect } from 'chai';

import { ModuleMetadata } from '@angular/compiler-cli';
import { configs, readFile, writeFile } from './testing/utils';
import { createBuildTask as _createBuildTask } from '../index';
import { getCliConfiguration as _getCliConfiguration } from '../src/cli/ng-cli';


let createBuildTask: typeof _createBuildTask;
let getCliConfiguration: typeof _getCliConfiguration;
try {
  createBuildTask = require('../dist').createBuildTask;
  getCliConfiguration = require('../dist/src/cli/ng-cli').getCliConfiguration;
} catch (e) {
  createBuildTask = require('../index').createBuildTask;
  getCliConfiguration = require('../src/cli/ng-cli').getCliConfiguration;
}

const tsConfig = require(configs.pluginLib.ts);
const outDir = Path.resolve(Path.dirname(configs.pluginLib.ts), tsConfig.compilerOptions.outDir || '.');

function delOutDir(outDir: string) {
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

describe('Build Task - Integration', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  const outDirs = {
    ngCliWrapper: outDir + '-ng-cli-flat',
    flatModule: outDir + '-flat',
    perModule: outDir + '-module',
    skipTemplateCodegen: outDir + '-skipTemplateCodegen'
  };

  it('angular cli wrapper (ng-cli) should inline resources in flat file output', async () => {
    const localOutDir = outDirs.ngCliWrapper;
    delOutDir(localOutDir);

    const tmpTsConfig = await createTempTsConfig( config => {
      config.compilerOptions.outDir = localOutDir;
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

    process.argv.splice(2, process.argv.length - 2, 'build');
    const parsedDiagnostics = await getCliConfiguration()
      .then( config => createBuildTask(config, tmpTsConfig).run() );

    rimraf.sync(tmpTsConfig);

    expect(parsedDiagnostics.error).to.be.undefined;

    const meta = await readFile(Path.resolve(localOutDir, 'ng-lib/src/my-lib.ng-flat.metadata.json'));
    const metadataBundle: ModuleMetadata = JSON.parse(meta);
    const LibComponentComponent: any = metadataBundle.metadata.LibComponentComponent;

    expect(LibComponentComponent.decorators[0].arguments[0]).to.eql({
      "selector": "lib-component",
      "template": "<h1>Hello World</h1>",
      "styles": [
        "h1 {\n  border: 15px black solid; }\n"
      ]
    });
  });

  it('should inline resources in flat file output', async () => {
    const localOutDir = outDirs.flatModule;
    delOutDir(localOutDir);

    const tmpTsConfig = await createTempTsConfig( config => {
      config.compilerOptions.outDir = localOutDir;
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
    const parsedDiagnostics = await createBuildTask(config, tmpTsConfig).run();

    rimraf.sync(tmpTsConfig);

    expect(parsedDiagnostics.error).to.be.undefined;

    const meta = await readFile(Path.resolve(localOutDir, 'ng-lib/src/my-lib.ng-flat.metadata.json'));
    const metadataBundle: ModuleMetadata = JSON.parse(meta);
    const LibComponentComponent: any = metadataBundle.metadata.LibComponentComponent;

    expect(LibComponentComponent.decorators[0].arguments[0]).to.eql({
      "selector": "lib-component",
      "template": "<h1>Hello World</h1>",
      "styles": [
        "h1 {\n  border: 15px black solid; }\n"
      ]
    });
  });

  it('cli and ng-cli should match', async () => {
    const ngCliMeta = await readFile(Path.resolve(outDirs.ngCliWrapper, 'ng-lib/src/my-lib.ng-flat.metadata.json'));
    const cliMeta = await readFile(Path.resolve(outDirs.flatModule, 'ng-lib/src/my-lib.ng-flat.metadata.json'));
    expect(ngCliMeta).to.eq(cliMeta);
  });

  it('should inline resources per module', async () => {
    const localOutDir = outDirs.perModule;
    delOutDir(localOutDir);

    const tmpTsConfig = await createTempTsConfig( config => {
      config.compilerOptions.outDir = localOutDir;
      return Object.assign(config, {
        angularCompilerOptions: {
          annotateForClosureCompiler: true,
          skipMetadataEmit: false,
          skipTemplateCodegen: true,
          strictMetadataEmit: true
        }
      });
    });

    const config = require(configs.pluginLib.wp)(true);
    const parsedDiagnostics = await createBuildTask(config, tmpTsConfig).run();

    rimraf.sync(tmpTsConfig);

    expect(parsedDiagnostics.error).to.be.undefined;
    const meta = await readFile(Path.resolve(localOutDir, 'ng-lib/src/lib-component/lib-component.component.metadata.json'));
    const metadataBundle: ModuleMetadata = JSON.parse(meta)[0];
    const LibComponentComponent: any = metadataBundle.metadata.LibComponentComponent;

    expect(LibComponentComponent.decorators[0].arguments[0]).to.eql({
      "selector": "lib-component",
      "template": "<h1>Hello World</h1>",
      "styles": [
        "h1 {\n  border: 15px black solid; }\n"
      ]
    });
  });

  it('should emit AOT artifacts when skipTemplateCodegen is false and not inline resources.', async () => {
    const localOutDir = outDirs.skipTemplateCodegen;
    delOutDir(localOutDir);

    const tmpTsConfig = await createTempTsConfig( config => {
      config.compilerOptions.outDir = localOutDir;
      return Object.assign(config, {
        angularCompilerOptions: {
          annotateForClosureCompiler: true,
          skipMetadataEmit: false,
          skipTemplateCodegen: false,
          strictMetadataEmit: true
        }
      });
    });

    const config = require(configs.pluginLib.wp)(true);
    const parsedDiagnostics = await createBuildTask(config, tmpTsConfig).run();

    rimraf.sync(tmpTsConfig);

    expect(parsedDiagnostics.error).to.be.undefined;
    const meta = await readFile(Path.resolve(localOutDir, 'ng-lib/src/lib-component/lib-component.component.metadata.json'));
    const metadataBundle: ModuleMetadata = JSON.parse(meta)[0];
    const LibComponentComponent: any = metadataBundle.metadata.LibComponentComponent;

    expect(LibComponentComponent.decorators[0].arguments[0]).to.eql({
      "selector": "lib-component",
      "styleUrls": [
        "./lib-component.component.scss"
      ],
      "templateUrl": "./lib-component.component.html"
    });

    const p = Path.resolve(localOutDir, 'ng-lib/src/lib-component/lib-component.component.');
    ['ngfactory.js', 'ngsummary.json', 'scss.shim.ngstyle.js'].forEach(suffix => {
      expect(FS.existsSync(p + suffix)).to.eq(true, 'Expected AOT file ' + p + suffix)
    });
  });
});

