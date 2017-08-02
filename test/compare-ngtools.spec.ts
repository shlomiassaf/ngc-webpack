import * as fs from 'fs';
import { expect } from 'chai';

const rimraf = require('rimraf');

import { runWebpack, resolveWebpackConfig, getTsConfigMeta, configs, logWebpackStats } from './testing/utils';

describe('Full Webpack build', () => {
  describe('NGTools baseline', () => {
    
    const outputMap = [
      ['main.bundle.js', 1580541],
      ['bundle.avatar.png', 2096],
      ['bundle.on-off.png', 4622],
      ['bundle.check-on.png', 2836],
      ['0.chunk.js', 11913],
      ['bundle.check-off.png', 2894],
      ['bundle.css', 182],
      ['index.html', 239]
    ];

    let test = it('should compile using webpack plugin-full and match output files', async () => {
      const tsMetaPluginFull = getTsConfigMeta(configs.pluginFull.ts);
      const wpConfig = resolveWebpackConfig(require(configs.pluginFull.wp)());
      rimraf.sync(tsMetaPluginFull.absGenDir);

      const stats = await runWebpack(wpConfig).done;
      logWebpackStats(stats);
      expect(fs.existsSync(tsMetaPluginFull.absGenDir));

      const assets = stats.toJson().assets;
      expect(assets.length).to.equal(outputMap.length);
      for (let [key, size] of outputMap) {
        const asset = assets.find ( a => a.name === key );
        expect(asset).not.to.equal(undefined, `ASSET '${key}'`);
        expect(asset.size).to.be.closeTo(<any>size, asset.size * 0.05, `ASSET '${key}'`);
      }
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

    test = it('should compile using webpack ngtools-full and match output files (control test)', async () => {
      const tsMetaNgtoolsFull = getTsConfigMeta(configs.ngToolsFull.ts);
      const wpConfig = resolveWebpackConfig(require(configs.ngToolsFull.wp)());
      rimraf.sync(tsMetaNgtoolsFull.absGenDir);

      const stats = await runWebpack(wpConfig).done;
      logWebpackStats(stats);
      expect(fs.existsSync(tsMetaNgtoolsFull.absGenDir));

      const assets = stats.toJson().assets;
      expect(assets.length).to.equal(outputMap.length);
      for (let [key, size] of outputMap) {
        const asset = assets.find ( a => a.name === key );
        expect(asset).not.to.equal(undefined, `ASSET '${key}'`);
        expect(asset.size).to.be.closeTo(<any>size, asset.size * 0.05, `ASSET '${key}'`);
      }
    });
    (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  });
});

