import * as Path from 'path';
import * as fs from 'fs';
import { spawn as spawnFactory } from 'child_process';
import { expect } from 'chai';


const rimraf = require('rimraf');
const mapper = require('node-map-directory');

const APP_OUTPUT = Path.resolve('dist/test/ng-app');
/**
 * Simple spawn wrapper that accepts a raw command line (with args) and return a promise with the result.
 * All IO goes to the console.
 * @param cmd
 * @returns {Promise<T>}
 */
export function spawn(cmd): Promise<void> {
  return new Promise( (resolve, reject) => {
    const args = cmd.split(' ');
    const spawnInstance = spawnFactory(args.shift(), args, {stdio: "inherit"});

    spawnInstance.on('exit', function (code) {
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
}

describe('Plugin Integration tests', () => {
  const tsConfig = JSON.parse(fs.readFileSync('tsconfig.integration.json', 'utf8'));
  const codeGenDir = Path.resolve(tsConfig.angularCompilerOptions.genDir);

  rimraf.sync(codeGenDir);
  rimraf.sync(APP_OUTPUT);

  let test = it('should build using the plugin', () => {
    return spawn('webpack --config webpack.integration.js --bail')
      .then( () => {
        expect(fs.existsSync(codeGenDir));
      })
      .catch( err => expect(err).to.be.undefined );
  });
  (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  it('should provide resources to webpack and return transformed values', () => {
    const code = fs.readFileSync(Path.join(codeGenDir, 'test/ng-app/app/home/home.component.scss.shim.ngstyle.ts'), 'utf8');
    const RE = /export const styles:any\[] = \['(.+)']/;

    expect(RE.exec(code)[1].indexOf(`$`)).to.equal(-1);
  });

  test = it('should create identical file structure to the one created by the compiler-cli', () => {
    const promises = [
      mapper(codeGenDir).then( m => JSON.stringify(m)),
      Promise.resolve()
        .then( () => rimraf.sync(codeGenDir) )
        .then( () => spawn('./node_modules/.bin/ngc -p tsconfig.integration.json') )
        .then( () => mapper(codeGenDir).then( m => JSON.stringify(m)) )
    ];

    return Promise.all(promises)
      .then( maps => expect(maps[0]).to.equal(maps[1]));
  });
  (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  it('should not provide resources to webpack and return transformed values (control test)', () => {
    const code = fs.readFileSync(Path.join(codeGenDir, 'test/ng-app/app/home/home.component.scss.shim.ngstyle.ts'), 'utf8');
    const RE = /export const styles:any\[] = \['(.+)']/;

    expect(RE.exec(code)[1].indexOf(`$`)).to.be.greaterThan(-1);
  });
});