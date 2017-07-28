import 'rxjs/add/operator/filter';
import * as Path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { expect } from 'chai';


import { tsConfig, compile, onNgToolsLoaderHit } from './testing/aot-cleanup-test-utils';
import { runWebpack, resolveWebpackConfig, getTsConfigMeta, configs } from './testing/utils';

const srcFileDir = Path.join(__dirname, 'aot-cleanup-transformer');
const compiled: any = compile([Path.join(srcFileDir, 'module.ts')]);
const ngToolsCompiled: any = {};

onNgToolsLoaderHit.subscribe( result => {
  if (!result.error) {
    ngToolsCompiled[Path.basename(result.resourcePath.replace('.ts', '.js'))] = result.source;
  }
});

describe('AOT Cleanup transformer', async () => {
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
      .catch( err => expect(err).to.be.undefined );
  });
  (test as any).timeout(1000 * 60 * 3); // 3 minutes, should be enough to compile.

  Object.keys(compiled).forEach( key => {
    it ('should validate file ' + key, () => {
      // we need to pass the transformers output through a single module TypeScript transpilation
      // since this is done by ngTools which causes some side effects (e.g. removal of unused imports)
      const result = ts.transpileModule(compiled[key], {
        compilerOptions: Object.assign({}, tsConfig, {
          removeComments: true
        }),
        fileName: Path.join(srcFileDir, key.replace('.js', '.ts'))
      });

      const ngToolsSource = ngToolsCompiled[key].split('\n');
      ngToolsSource.pop();
      ngToolsSource.push('');

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