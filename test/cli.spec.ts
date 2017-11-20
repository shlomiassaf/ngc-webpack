import * as Path from 'path';
import * as FS from 'fs';
import * as rimraf from 'rimraf';
import { expect } from 'chai';

import { ModuleMetadata } from '@angular/compiler-cli';
import { runWebpack, resolveWebpackConfig, configs, logWebpackStats, readFile, writeFile } from './testing/utils';
import { runCli as _runCli } from '../index';


let runCli: typeof _runCli;
try {
  runCli = require('../dist').runCli;
} catch (e) {
  runCli = require('../index').runCli;
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

describe('ngc-webpack CLI', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  it('CLI With flat module output', async () => {
    const flatOutDir = outDir + '-flat';
    delOutDir(flatOutDir);

    const tmpTsConfig = await createTempTsConfig( config => {
      config.compilerOptions.outDir = flatOutDir;
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
    const parsedDiagnostics = await runCli(config, ['-p', tmpTsConfig], { p: tmpTsConfig, _: [] });

    rimraf.sync(tmpTsConfig);

    expect(parsedDiagnostics.error).to.be.undefined;

    const meta = await readFile(Path.resolve(flatOutDir, 'ng-lib/src/my-lib.ng-flat.metadata.json'));
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

  it('should inline resources per module', async () => {
    delOutDir(outDir);

    const tmpTsConfig = await createTempTsConfig( config => {
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
    const parsedDiagnostics = await runCli(config, ['-p', tmpTsConfig], { p: tmpTsConfig, _: [] });

    rimraf.sync(tmpTsConfig);

    expect(parsedDiagnostics.error).to.be.undefined;
    const meta = await readFile(Path.resolve(outDir, 'ng-lib/src/lib-component/lib-component.component.metadata.json'));
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
    delOutDir(outDir);

    const tmpTsConfig = await createTempTsConfig( config => {
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
    const parsedDiagnostics = await runCli(config, ['-p', tmpTsConfig], { p: tmpTsConfig, _: [] });

    rimraf.sync(tmpTsConfig);

    expect(parsedDiagnostics.error).to.be.undefined;
    const meta = await readFile(Path.resolve(outDir, 'ng-lib/src/lib-component/lib-component.component.metadata.json'));
    const metadataBundle: ModuleMetadata = JSON.parse(meta)[0];
    const LibComponentComponent: any = metadataBundle.metadata.LibComponentComponent;

    expect(LibComponentComponent.decorators[0].arguments[0]).to.eql({
      "selector": "lib-component",
      "styleUrls": [
        "./lib-component.component.scss"
      ],
      "templateUrl": "./lib-component.component.html"
    });

    const p = Path.resolve(outDir, 'ng-lib/src/lib-component/lib-component.component.');
    ['ngfactory.js', 'ngsummary.json', 'scss.shim.ngstyle.js'].forEach(suffix => {
      expect(FS.existsSync(p + suffix)).to.eq(true, 'Expected AOT file ' + p + suffix)
    });
  });
});

