import 'rxjs/add/operator/filter';
import * as Path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { expect } from 'chai';
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;


import ngcLoader from '@ngtools/webpack';
import { aotCleanLoader as aotCleanLoaderText, resetLoader } from '../src/aot-clean-transformer/loader/text-based-loader';
import { aotCleanLoader as aotCleanLoaderTransformer } from '../src/aot-clean-transformer/loader/transformer-based-loader';

import * as aotCleanupTestUtils from './testing/aot-cleanup-test-utils';
import { runWebpack, resolveWebpackConfig, getTsConfigMeta, configs, logWebpackStats} from './testing/utils';

const srcFileDir = Path.join(process.cwd(), 'test', 'aot-cleanup-transformer');
const ngToolsCompiled: any = {};
let selfCompiled: any;


aotCleanupTestUtils.onNgToolsLoaderHit.subscribe( result => {
  if (!result.error) {
    if (aotCleanupTestUtils.hijackedLoader === aotCleanLoaderText || aotCleanupTestUtils.hijackedLoader === aotCleanLoaderTransformer) {
      selfCompiled[Path.basename(result.resourcePath)] = result.source;
    } else {
      ngToolsCompiled[Path.basename(result.resourcePath)] = result.source;
    }
  }
});

describe('AOT Cleanup loader', () => {
  const tsMetaAotTransform = getTsConfigMeta(configs.aotTransform.ts);


  let test = it('should compile using @ngtoools/webpack', async () => {
    aotCleanupTestUtils.setWrappedLoader(ngcLoader);
    const wpConfig = resolveWebpackConfig(require(configs.aotTransform.wp));
    const stats = await runWebpack(wpConfig).done;
    logWebpackStats(stats);
    expect(fs.existsSync(tsMetaAotTransform.absGenDir));
    const bundleCode = fs.readFileSync(Path.resolve('dist/test/aot-transformer/main.bundle.js'), 'utf8');
    const appModuleCode = `var AppModule = (function () {
    function AppModule(myService, token) {
        this.myService = myService;
        this.token = token;
        this.myService.myMethod();
        this.justASimpleClass = new JustASimpleClass(myService);
    }
    AppModule.ctorParameters = function () { return [{ type: __WEBPACK_IMPORTED_MODULE_4__service__["a" /* MyServiceService */] }, { type: __WEBPACK_IMPORTED_MODULE_3__pipe__["a" /* MyPipePipe */], decorators: [{ type: __WEBPACK_IMPORTED_MODULE_0__angular_core__["a" /* Inject */], args: [__WEBPACK_IMPORTED_MODULE_4__service__["b" /* MyTokenToken */]] }] }]; };
    return AppModule;
}());`;
    expect(bundleCode).to.contain(appModuleCode);
  });
  (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  ['Text', 'Transformer'].forEach( loaderType => {
    describe(`${loaderType} based loader`, () => {
      test = it('should compile using ngc-webpack loader', () => {
        const loaderFn = loaderType === 'Text'
          ? aotCleanLoaderText
          : loaderType === 'Transformer' ? aotCleanLoaderTransformer : undefined
        ;

        if (loaderType === 'Text') {
          resetLoader();
        }

        if (!loaderFn) {
          throw new Error(`${loaderFn} unknown`);
        }

        selfCompiled = {};
        aotCleanupTestUtils.setWrappedLoader(loaderFn);
        const wpConfig = Object.assign({} , resolveWebpackConfig(require(configs.aotTransform.wp)), { plugins: [new CheckerPlugin()] });

        return runWebpack(wpConfig).done
          .then( (stats) => {
            logWebpackStats(stats);
            expect(fs.existsSync(tsMetaAotTransform.absGenDir));
          })
          .catch( err => expect(err).to.be.undefined );
      });
      (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.


      fs.readdirSync(srcFileDir).forEach( key => {it ('should validate file ' + key, () => {

        const result = ts.transpileModule(selfCompiled[key], {
          compilerOptions: Object.assign({}, aotCleanupTestUtils.tsConfig, {
            removeComments: true
          }),
          fileName: Path.join(srcFileDir, key)
        });

        /* NOTE: Constructor's design:paramtypes
         We are taking the ngc-webpack loader output, which is TS and comparing it to the ngTools loader
         output, which is JS. To do that we need to transpile ngc-loader output into JS.

         Because we are using `transpileModule` the output of `__metadata("design:paramtypes"...` is
         the same for ngTools loader and ngc-webpack loader and the test passes.

         However, in full webpack compilation they will differ (i.e bundle output will not match)

         For more details see the same note in "aot-cleanup-transformer.spec"
         */

        const ngToolsSource = ngToolsCompiled[key].split('\n');
        ngToolsSource.pop();
        ngToolsSource.push('');


        /* NOTE: Modifying ngTools loader output to pass tests
         Currently, ngTools (1.6.0-rc.3) has 2 bugs that effect the output:

         1. When a class with constructor parameters has multiple class decorators (more then 1)
         ngTools loader will append multiple static ctorParameters() methods to the class, all
         identical.

         2. When a constructor parameter type is an interface or a type (i.e. virtual) ngTools
         loader will emit it as a literal in the static ctorParameters() method despite it
         being undefined.

         For more details see the same note in "aot-cleanup-transformer.spec"
         */


        if (key === 'service.ts') {
          for (let i=0; i<ngToolsSource.length; i++) {
            if (ngToolsSource[i].startsWith('    MyServiceService.ctorParameters = function ()')) {
              // FIX #2
              ngToolsSource[i] = ngToolsSource[i].replace('MyType', 'Object');
              ngToolsSource[i] = ngToolsSource[i].replace('OnDestroy', 'Object');

              // FIX #1
              i++;
              while (i<ngToolsSource.length) {
                if (ngToolsSource[i].startsWith('    MyServiceService.ctorParameters = function ()')) {
                  ngToolsSource.splice(i, 1);
                } else {
                  break;
                }
              }
              break;
            }
          }
        }

        // FIX #2
        else if (key === 'component.ts') {
          for (let i=0; i<ngToolsSource.length; i++) {
            if (ngToolsSource[i].startsWith('    MyComponentComponent.ctorParameters = function ()')) {
              const row = ngToolsSource.splice(i, 1)[0];
              ngToolsSource.pop();
              ngToolsSource.push(row.replace('MyInterface', 'Object').trim());
              ngToolsSource.push('');
              break;
            }
          }
        }


        expect(ngToolsSource.join('\n')).to.equal(result.outputText);
      })
      });
    })
  });

});