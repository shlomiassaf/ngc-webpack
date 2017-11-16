import { expect } from 'chai';

import { NgcWebpackPluginOptions } from 'ngc-webpack';
import { runWebpack, resolveWebpackConfig, configs, logWebpackStats } from './testing/utils';

type UniqueNgcOptions = Partial<Pick<NgcWebpackPluginOptions,
  'beforeRun' | 'readFileTransformer' | 'resourcePathTransformer' | 'resourceTransformer' | 'tsTransformers'>>;


describe('patch-angular-compiler-cli', function() {
  this.timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.
  
  const run = async (wpConfig) => {
    const stats = await runWebpack(resolveWebpackConfig(wpConfig)).done;
    logWebpackStats(stats);
    return stats;
  };

  const code = `
export function MyPropDecorator(value: () => any) {
  return (target: Object, key: string) => {  }
}


export class MyClass {
  @MyPropDecorator(() => 15)
  prop: string;
}
`;

  it('should throw when using specific expression with lowering expression on', async () => {

    const ngcOptions: UniqueNgcOptions = {
      readFileTransformer: {
        predicate: fileName => fileName.endsWith('app.module.ts'),
        transform: (fileName, content) => content + code
      }
    };

    const config = require(configs.pluginFull.wp)(true, ngcOptions);
    const stats = await run(config);
    const compileErrors = stats['compilation'] && stats['compilation'].errors;

    expect(compileErrors).not.to.be.undefined;
    expect(compileErrors.length).to.eq(1);
    expect(compileErrors[0]).to.include(
      `TypeError: Cannot read property 'kind' of undefined`,
      `No exception on lowering expression, looks like https://github.com/angular/angular/issues/20216 has been fixed.`
    );
  });

  it('should not throw when using specific expression with lowering expression on and a patch in place', async () => {
    const lowerExpressions = require('@angular/compiler-cli/src/transformers/lower_expressions');
    const getExpressionLoweringTransformFactory = lowerExpressions.getExpressionLoweringTransformFactory;
    require('../src/patch-angular-compiler-cli');

    const ngcOptions: UniqueNgcOptions = {
      readFileTransformer: {
        predicate: fileName => fileName.endsWith('app.module.ts'),
        transform: (fileName, content) => content + code
      }
    };

    const config = require(configs.pluginFull.wp)(true, ngcOptions);
    const stats = await run(config);
    const compileErrors = stats['compilation'] && stats['compilation'].errors;

    lowerExpressions.getExpressionLoweringTransformFactory = getExpressionLoweringTransformFactory;

    expect(compileErrors.length).to.eq(0);
  });
});

