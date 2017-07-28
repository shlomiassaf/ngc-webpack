import 'rxjs/add/operator/filter';
import * as Path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { expect } from 'chai';


import * as aotCleanupTestUtils from './testing/aot-cleanup-test-utils';
import { runWebpack, resolveWebpackConfig, getTsConfigMeta, configs } from './testing/utils';

const srcFileDir = Path.join(process.cwd(), 'test', 'aot-cleanup-transformer');
const ngToolsCompiled: any = {};
const selfCompiled: any = {};


aotCleanupTestUtils.onNgToolsLoaderHit.subscribe( result => {
  if (!result.error) {
    if (aotCleanupTestUtils.hijackedLoader === 'self') {
      selfCompiled[Path.basename(result.resourcePath)] = result.source;
    } else {
      ngToolsCompiled[Path.basename(result.resourcePath)] = result.source;
    }
  }
});

describe('AOT Cleanup loader', async () => {
  const tsMetaAotTransform = getTsConfigMeta(configs.aotTransform.ts);


  let test = it('should compile using @ngtoools/webpack', () => {

    const wpConfig = resolveWebpackConfig(require(configs.aotTransform.wp));

    return runWebpack(wpConfig).done
      .then( () => {
        expect(fs.existsSync(tsMetaAotTransform.absGenDir));
        const bundleCode = fs.readFileSync(Path.resolve('dist/test/aot-transformer/main.bundle.js'), 'utf8');
        const appModuleCode = `var AppModule = (function () {
    function AppModule(myService, token) {
        this.myService = myService;
        this.token = token;
        this.myService.myMethod();
    }
    AppModule.ctorParameters = function () { return [{ type: __WEBPACK_IMPORTED_MODULE_4__service__["a" /* MyServiceService */] }, { type: __WEBPACK_IMPORTED_MODULE_3__pipe__["a" /* MyPipePipe */], decorators: [{ type: __WEBPACK_IMPORTED_MODULE_0__angular_core__["a" /* Inject */], args: [__WEBPACK_IMPORTED_MODULE_4__service__["b" /* MyTokenToken */]] }] }]; };
    return AppModule;
}());`;
        expect(bundleCode).to.contain(appModuleCode);
      })
      .then( () => {
        aotCleanupTestUtils.setWrappedLoader('self');
        return runWebpack( Object.assign({}, wpConfig, { plugins: [] }) ).done;
      });
  });
  (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.


  fs.readdirSync(srcFileDir).forEach( key => {it ('should validate file ' + key, () => {
      const ngToolsSource = ngToolsCompiled[key].split('\n');

      ngToolsSource.pop();
      ngToolsSource.push('');

      const result = ts.transpileModule(selfCompiled[key], {
        compilerOptions: Object.assign({}, aotCleanupTestUtils.tsConfig, {
          removeComments: true
        }),
        fileName: Path.join(srcFileDir, key)
      });


    // TODO: This is to handle a bug in ngTools where a non-angular parameter decorator
    //        results in two identical ctorParameters functions, one after the other.
    if (key === 'service.ts') {
      for (let i=0; i<ngToolsSource.length; i++) {
        if (ngToolsSource[i].startsWith('    MyServiceService.ctorParameters = function ()')) {
          // handle same bug as the one in component.ts
          ngToolsSource[i] = ngToolsSource[i].replace('MyType', 'Object');

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

    // TODO: This is to handle a bug in ngTools where a interfaces and types are treated as values.
    else if (key === 'component.ts') {
      for (let i=0; i<ngToolsSource.length; i++) {
        if (ngToolsSource[i].startsWith('    MyComponentComponent.ctorParameters = function ()')) {
          ngToolsSource[i] = ngToolsSource[i].replace('MyInterface', 'Object');
          break;
        }
      }
    }


      expect(ngToolsSource.join('\n')).to.equal(result.outputText);
    })
  });

});