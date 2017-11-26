import * as Path from 'path';
import * as FS from 'fs';
import * as rimraf from 'rimraf';
import * as tmp from 'tmp';
import { expect } from 'chai';

import { ModuleMetadata } from '@angular/compiler-cli';
import { configs, readFile } from './testing/utils';
import { createBuildTaskFromConfigFile as _createBuildTaskFromConfigFile } from '../index';
import { getCliConfiguration as _getCliConfiguration } from '../src/cli/ng-cli';


let createBuildTaskFromConfigFile: typeof _createBuildTaskFromConfigFile;
let getCliConfiguration: typeof _getCliConfiguration;
try {
  createBuildTaskFromConfigFile = require('../dist').createBuildTaskFromConfigFile;
  getCliConfiguration = require('../dist/src/cli/ng-cli').getCliConfiguration;
} catch (e) {
  createBuildTaskFromConfigFile = require('../index').createBuildTaskFromConfigFile;
  getCliConfiguration = require('../src/cli/ng-cli').getCliConfiguration;
}

const NG_LIB_PROJECT_ROOT = Path.resolve(__dirname, 'ng-lib');

function delOutDir(outDir: string) {
  const root = Path.resolve(Path.dirname(configs.pluginLib.ts), '.');
  const cwd = process.cwd();
  if (outDir.length > root.length && outDir.length > cwd.length) {
    rimraf.sync(outDir);
  }
}

describe('From Config Build Task - Integration', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  const destDirs = {
    ngCliWrapper: '../../dist/test/ng-lib-plugin-ng-cli-flat',
    flatModule: '../../dist/test/ng-lib-plugin-flat'
  };

  it('angular cli wrapper (ng-cli) should inline resources in flat file output', async () => {
    const localOutDir = Path.resolve(NG_LIB_PROJECT_ROOT, destDirs.ngCliWrapper);
    delOutDir(localOutDir);

    process.argv.splice(2, process.argv.length - 2, 'build');

    // this is a mock of a `package.json` files in the location "test/ng-lib/package.json"
    // so all relative paths are relative to that that location
    const pkgJson = {
      "ngLibrary": {
        "name": "my-lib",
        "src": ".",
        "dest": destDirs.ngCliWrapper,
        "entry": "src/index.ts",
        "externals": {},
        "flatModuleFileName": "my-lib.ng-flat",
        "compilerOptions": {
          "declaration": true,
          "rootDir": ".."   // going 1 up is like "./test" in original tsconfig location
        }
      }
    };

    tmp.setGracefulCleanup();
    const tmpPkgJson = tmp.fileSync({ discardDescriptor: true, dir: NG_LIB_PROJECT_ROOT, postfix: '.package.json' });
    FS.writeFileSync(tmpPkgJson.name, JSON.stringify(pkgJson), { encoding: 'utf-8' });

    const tasks = await getCliConfiguration()
      .then( config => createBuildTaskFromConfigFile(config, tmpPkgJson.name) );

    for ( let t of tasks) {
      const parsedDiagnostics = await t.run();
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
    }
  });

  it('should inline resources in flat file output', async () => {
    const localOutDir = Path.resolve(NG_LIB_PROJECT_ROOT, destDirs.flatModule);
    delOutDir(localOutDir);

    // this is a mock of a `package.json` files in the location "test/ng-lib/package.json"
    // so all relative paths are relative to that that location
    const pkgJson = {
      "ngLibrary": {
        "name": "my-lib",
        "src": ".",
        "dest": destDirs.flatModule,
        "entry": "src/index.ts",
        "externals": {},
        "flatModuleFileName": "my-lib.ng-flat",
        "compilerOptions": {
          "declaration": true,
          "rootDir": ".."   // going 1 up is like "./test" in original tsconfig location
        }
      }
    };

    tmp.setGracefulCleanup();
    const tmpPkgJson = tmp.fileSync({ discardDescriptor: true, dir: NG_LIB_PROJECT_ROOT, postfix: '.package.json' });
    FS.writeFileSync(tmpPkgJson.name, JSON.stringify(pkgJson), { encoding: 'utf-8' });


    const config = require(configs.pluginLib.wp)(true);
    const tasks = createBuildTaskFromConfigFile(config, tmpPkgJson.name);
    for ( let t of tasks) {
      const parsedDiagnostics = await t.run();
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
    }
  });

  it('cli and ng-cli should match', async () => {
    const ngCliMeta = await readFile(Path.resolve(NG_LIB_PROJECT_ROOT, destDirs.ngCliWrapper, 'ng-lib/src/my-lib.ng-flat.metadata.json'));
    const cliMeta = await readFile(Path.resolve(NG_LIB_PROJECT_ROOT, destDirs.flatModule, 'ng-lib/src/my-lib.ng-flat.metadata.json'));
    expect(ngCliMeta).to.eq(cliMeta);
  });

});

