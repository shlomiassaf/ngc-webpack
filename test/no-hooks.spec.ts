import { expect } from 'chai';

import { runWebpack, resolveWebpackConfig, configs, logWebpackStats } from './testing/utils';

describe('@ngtools baseline', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  describe('no-hooks (pass-through)', () => {

    const outputMap = [
      ['inline.bundle.js', 6000],
      ['inline.bundle.js.map', 6000],
      ['main.bundle.js', 1580541],
      ['main.bundle.js.map', 3580541],
      ['bundle.avatar.png', 2096],
      ['bundle.on-off.png', 4622],
      ['bundle.check-on.png', 2836],
      ['0.chunk.js', 11913],
      ['0.chunk.js.map', 4913],
      ['bundle.check-off.png', 2894],
      ['bundle.css', 182],
      ['bundle.css.map', 98],
      ['index.html', 239]
    ];

    const assetsStore = {
      jit: {
        ngcwebpack: null,
        ngtools: null
      },
      aot: {
        ngcwebpack: null,
        ngtools: null
      }
    };

    const run = async (wpConfig) => {
      const stats = await runWebpack(resolveWebpackConfig(wpConfig)).done;
      logWebpackStats(stats);

      const compileErrors = stats['compilation'] && stats['compilation'].errors;
      if (compileErrors) {
        expect(compileErrors.length).to.be
          .lt(1, `Expected no TypeScript errors, found ${compileErrors.length}\n` + compileErrors.map(e => (e.message || e) + '\n'));
      }
      const assets = stats.toJson().assets;
      expect(assets.length).to.equal(outputMap.length);
      return assets;
    };

    it('should compile using webpack plugin-full JIT', async () => {
      assetsStore.jit.ngcwebpack = await run(require(configs.pluginFull.wp)(false));
    });

    it('should compile using webpack plugin-full AOT', async () => {
      const cfg = require(configs.pluginFull.wp)(true);
      cfg.output.path += '-aot';
      assetsStore.aot.ngcwebpack = await run(cfg);
    });

    it('should compile using webpack ngtools-full JIT', async () => {
      assetsStore.jit.ngtools = await run(require(configs.ngToolsFull.wp)(false));
    });

    it('should compile using webpack ngtools-full AOT', async () => {
      const cfg = require(configs.ngToolsFull.wp)(true);
      cfg.output.path += '-aot';
      assetsStore.aot.ngtools = await run(cfg);
    });

    it('should match JIT outputs', () => {
      for (let [key, size] of outputMap) {
        const assetNgt = assetsStore.jit.ngtools.find ( a => a.name === key );
        const assetNgc = assetsStore.jit.ngcwebpack.find ( a => a.name === key );
        expect(assetNgt.size).to.eql(assetNgc.size)
      }
    });

    it('should match AOT outputs', () => {
      for (let [key, size] of outputMap) {
        const assetNgt = assetsStore.aot.ngtools.find ( a => a.name === key );
        const assetNgc = assetsStore.aot.ngcwebpack.find ( a => a.name === key );
        expect(assetNgt.size).to.eql(assetNgc.size)
      }
    });
  });
});

