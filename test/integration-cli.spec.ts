import * as Path from 'path';
import * as fs from 'fs';
import { expect } from 'chai';


const rimraf = require('rimraf');
const mapper = require('node-map-directory');

import { spawn, runWebpack, resolveWebpackConfig, getTsConfigMeta, configs, occurrences, logWebpackStats } from './testing/utils';

describe('Integration', () => {
  const tsMetaNgcW = getTsConfigMeta(configs.cli.ts);
  const tsMetaPlugin = getTsConfigMeta(configs.plugin.ts);
  const tsMetaNgc = getTsConfigMeta(configs.ngc.ts);

  describe('ngc-w CLI', () => {
    let bundleCode: string;
    rimraf.sync(tsMetaNgcW.absGenDir);

    let test = it('should compile using ngc-webapck', () => {
      return spawn(`node dist/src/main.js -p ${configs.cli.ts} --webpack ${configs.cli.wp}`)
        .then( () => {
          expect(fs.existsSync(tsMetaNgcW.absGenDir));
        })
        .catch( err => expect(err).to.be.undefined );
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

    test = it('should bundle using webpack', () => {

      const wpConfig = resolveWebpackConfig(require(configs.cli.wp));

      return runWebpack(wpConfig).done
        .then( (stats) => {
          logWebpackStats(stats);
          expect(fs.existsSync('dist/test/ng-app-cli'));
          bundleCode = fs.readFileSync(Path.resolve('dist/test/ng-app-cli/main.bundle.js'), 'utf8');
        })
        .catch( err => expect(err).to.be.undefined );
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

    describe('Feature tests', () => {
      it('should load Component resources through webpack', () => {
        const code = fs.readFileSync(Path.join(tsMetaNgcW.absGenDir, 'test/ng-app/app/home/home.component.scss.shim.ngstyle.ts'), 'utf8');
        const RE = /export const styles:any\[] = \['(.+)']/;

        expect(RE.exec(code)[1].indexOf(`$`)).to.equal(-1);
      });

      it('replace a resources path so the project content is from the new path', () => {
        // We replaced a path so the new content should be in the bundle
        // Since we run via CLI they should be in the ngfactory styles shim
        // they will not be on the component since the 2nd pass (webpack) loads the original content
        // In runtime we will get the result we want..
        let count = occurrences(/\.this-replaced-app-component/gm, bundleCode);
        expect(count).to.equal(1);

        // CLI run means no removal of component meta resources so the original should appear once
        count = occurrences(/span\.active/gm, bundleCode);
        expect(count).to.equal(1);
      });

      it('replace a source content on the fly', () => {
        let count = occurrences(/HTML WAS HIJACKED BY A TEST!!!/gm, bundleCode);
        expect(count).to.equal(1);


        count = occurrences(/Submit Local State to App State/gm, bundleCode);
        expect(count).to.equal(1);
      });

    });

  });

  describe('Plugin', () => {
    let bundleCode: string;

    rimraf.sync(tsMetaPlugin.absGenDir);

    let test = it('should compile using webpack plugin', () => {

      const wpConfig = resolveWebpackConfig(require(configs.plugin.wp)());

      return runWebpack(wpConfig).done
        .then( (stats) => {
          logWebpackStats(stats);
          expect(fs.existsSync(tsMetaPlugin.absGenDir));
          bundleCode = fs.readFileSync(Path.resolve('dist/test/ng-app-plugin/main.bundle.js'), 'utf8');
        })
        .catch( err => expect(err).to.be.undefined );
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

    describe('Feature tests', () => {
      it('should load Component resources through webpack', () => {
        const code = fs.readFileSync(Path.join(tsMetaPlugin.absGenDir, 'test/ng-app/app/home/home.component.scss.shim.ngstyle.ts'), 'utf8');
        const RE = /export const styles:any\[] = \['(.+)']/;
        expect(RE.exec(code)[1].indexOf(`$`)).to.equal(-1);
      });

      it('replace a resources path so the project content is from the new path', () => {
        let count = occurrences(/\.this-replaced-app-component/gm, bundleCode);
        expect(count).to.equal(1);

        // We replace the component metadata templates so this should be gone.
        count = occurrences(/span\.active/gm, bundleCode);
        expect(count).to.equal(0);
      });

      it('replace a source content on the fly', () => {
        let count = occurrences(/HTML WAS HIJACKED BY A TEST!!!/gm, bundleCode);
        expect(count).to.equal(1);

        // We replace the component metadata templates so this should be gone.
        count = occurrences(/<div class="home-size">/gm, bundleCode);
        expect(count).to.equal(0);
      });

      it('should bundle resources once (factory ony)', () => {
        const count = occurrences(/\.home-size/gm, bundleCode);
        expect(count).to.equal(1);
      });

      it('should replace component templates bundled from source with content from supplied resource', () => {
        const match = /\/\* Content removed by ngc-webpack \*\//.exec(bundleCode);
        expect(!!match).to.be.true;
      });
    });

    test = it('should compile using webpack plugin with aot cleanup LOADER (default, text based)', () => {

      const wpConfig = resolveWebpackConfig(require(configs.plugin.wp)('loader'));

      return runWebpack(wpConfig).done
        .then( (stats) => {
          logWebpackStats(stats);
          expect(fs.existsSync(tsMetaPlugin.absGenDir));
          const bCode = fs.readFileSync(Path.resolve('dist/test/ng-app-plugin/main.bundle.js'), 'utf8');
          expect(bCode.length).lt(bundleCode.length);
        })
        .catch( err => expect(err).to.be.undefined );
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.


    test = it('should compile using webpack plugin with aot cleanup TRANSFORMER', () => {

      const wpConfig = resolveWebpackConfig(require(configs.plugin.wp)('transformer'));

      return runWebpack(wpConfig).done
        .then( (stats) => {
          logWebpackStats(stats);
          expect(fs.existsSync(tsMetaPlugin.absGenDir));
          const bCode = fs.readFileSync(Path.resolve('dist/test/ng-app-plugin/main.bundle.js'), 'utf8');
          expect(bCode.length).lt(bundleCode.length);
        })
        .catch( err => expect(err).to.be.undefined );
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  });

  describe('ngc CLI (control test)', () => {
    rimraf.sync(tsMetaNgc.absGenDir);

    let test = it('should compile using ngc', () => {

      return spawn(`./node_modules/.bin/ngc -p ${configs.ngc.ts}`)
        .then( () => {
          expect(fs.existsSync(tsMetaNgc.absGenDir));
        })
        .catch( err => expect(err).to.be.undefined );
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

    test = it('should bundle using webpack', () => {

      const wpConfig = resolveWebpackConfig(require(configs.ngc.wp));

      return runWebpack(wpConfig).done
        .then( (stats) => {
          logWebpackStats(stats);
          expect(fs.existsSync('dist/test/ng-app-ngc'));
        })
        .catch( err => expect(err).to.be.undefined );
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

    it('should NOT load Component resources through webpack', () => {
      const code = fs.readFileSync(Path.join(tsMetaNgc.absGenDir, 'test/ng-app/app/home/home.component.scss.shim.ngstyle.ts'), 'utf8');
      const RE = /export const styles:any\[] = \['(.+)']/;

      expect(RE.exec(code)[1].indexOf(`$`)).to.be.greaterThan(-1);
    });

    it('should bundle resources twice (factory + source)', () => {
      const code = fs.readFileSync(Path.resolve('dist/test/ng-app-ngc/main.bundle.js'), 'utf8');
      const count = occurrences(/\.home-size/gm, code);
      expect(count).to.equal(2);
    });
  });

  describe("ALL", () => {
    let test = it('should create identical file structure in all compilations', () => {
      const promises = [
        mapper(tsMetaNgcW.absGenDir).then( m => JSON.stringify(m).replace(/main\.browser\.aot\..*\./, '')),
        mapper(tsMetaPlugin.absGenDir).then( m => JSON.stringify(m).replace(/main\.browser\.aot\..*\./, '')),
        mapper(tsMetaNgc.absGenDir).then( m => JSON.stringify(m).replace(/main\.browser\.aot\..*\./, '')),
      ];

      return Promise.all(promises)
        .then( maps => expect(maps[0]).to.equal(maps[1]))
        .then( maps => expect(maps[0]).to.equal(maps[2]));
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  });

});

