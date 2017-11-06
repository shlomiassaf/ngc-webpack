import * as Path from 'path';
import { expect } from 'chai';

import { NgcWebpackPluginOptions } from '../src/plugin-options';
import { runWebpack, resolveWebpackConfig, configs, logWebpackStats, readFile, expectFileToMatch } from './testing/utils';

type UniqueNgcOptions = Pick<NgcWebpackPluginOptions,
  'beforeRun' | 'readFileTransformer' | 'resourcePathTransformer' | 'resourceTransformer' | 'tsTransformers'>;

describe('ngc-webpack features', function() {
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

  let test: any;

  describe('resources', () => {
    it('should replace the path for a resource', async () => {
      const ngcOptions: UniqueNgcOptions = {
        resourcePathTransformer: (p) => p.endsWith('app.component.css')
          ? Path.resolve('test/testing/replaced-resource.scss')
          : p
      };
      const config = require(configs.pluginFull.wp)(true, ngcOptions);
      await run(config);
      await expectFileToMatch(
        Path.join(config.output.path, 'main.bundle.js'),
        `var styles = [".this-replaced-app-component {\\n  display: none; }\\n"];`
      );
    });

    it('should replace the content for a resource', async () => {
      const ngcOptions: UniqueNgcOptions = {
        resourceTransformer: (p, c) => p.endsWith('home.component.html')
          ? '<h1>HTML WAS HIJACKED BY A TEST!!!</h1>'
          : c
      };
      const config = require(configs.pluginFull.wp)(true, ngcOptions);
      await run(config);
      await expectFileToMatch(
        Path.join(config.output.path, 'main.bundle.js'),
        `HTML WAS HIJACKED BY A TEST!!!`
      );

    });
  });

  describe('beforeRun', () => {
    let assets: any[];
    it('should invoke beforeRun with a working webpack resource compiler', async () => {
      let resourceCompiler: { get(fileName: string): Promise<string> };
      const compilations: Array<[string, string, string]> = [];

      const ngcOptions: UniqueNgcOptions = {
        beforeRun: rCompiler => {
          resourceCompiler = rCompiler;
          return;
        },
        resourceTransformer: (p, c) => {
          if (p.endsWith('.scss')) {
            return resourceCompiler.get(p)
              .then( content => {
                compilations.push([p, c, content]);
                return c;
              });
          } else {
            return c;
          }
        }
      };

      const config = require(configs.pluginFull.wp)(true, ngcOptions);
      assets = await run(config);

      expect(compilations.length).to.be.greaterThan(0);

      compilations.forEach( comp => {
        expect(comp[1]).to.eq(comp[2], `beforeRun resourceCompiler compilation mismatch for file ${comp[0]}`)
      });
    });

    it('using resource compiler should not effect bundle', async () => {
      const config = require(configs.pluginFull.wp)(true);
      const assetsClean = await run(config);

      expect(assets).to.eql(assetsClean);
      for (let i = 0; i < assets.length; i++) {
        await expectFileToMatch(
          Path.join(config.output.path, assets[i].name),
          await readFile(Path.join(config.output.path, assetsClean[i].name))
        );
      }
    });
  });

  describe('readFile', () => {
    it('should replace the content for a file', async () => {
      let predicateCount = 0;
      let transformCount = 0;
      const ngcOptions: UniqueNgcOptions = {
        readFileTransformer: {
          predicate: fileName => {
            predicateCount++;
            return fileName.endsWith('home.component.ts');
          },
          transform: (fileName, content) => {
            transformCount++;
            return content.replace(`console.log('submitState', value);`, `// TEST CLEARED console.log('submitState', value);`);
          }
        }
      };

      const config = require(configs.pluginFull.wp)(true, ngcOptions);
      await run(config);

      expect(transformCount).to.eq(1);
      expect(predicateCount).to.be.greaterThan(1);

      await expectFileToMatch(
        Path.join(config.output.path, 'main.bundle.js'),
        `// TEST CLEARED console.log('submitState', value);`
      );
    });
  });

});

