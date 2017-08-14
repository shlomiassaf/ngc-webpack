import 'rxjs/add/operator/filter';
import * as Path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { expect } from 'chai';


import ngcLoader from '@ngtools/webpack';

import { tsConfig, compile, onNgToolsLoaderHit, setWrappedLoader } from './testing/aot-cleanup-test-utils';
import { runWebpack, resolveWebpackConfig, getTsConfigMeta, configs, logWebpackStats } from './testing/utils';

const srcFileDir = Path.join(process.cwd(), 'test', 'aot-cleanup-transformer');
const compiled: any = compile([Path.join(srcFileDir, 'module.ts')]);
const ngToolsCompiled: any = {};

onNgToolsLoaderHit.subscribe( result => {
  if (!result.error) {
    ngToolsCompiled[Path.basename(result.resourcePath.replace('.ts', '.js'))] = result.source;
  }
});

describe('AOT Cleanup transformer', async () => {
  const tsMetaAotTransform = getTsConfigMeta(configs.aotTransform.ts);


  let test = it('should compile using @ngtoools/webpack', async () => {
    setWrappedLoader(ngcLoader);
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

  Object.keys(compiled).forEach( key => {
    it ('should validate file ' + key, () => {
      // The compiled content ( compiled[key] ) is already in JS and should match ngTools content.
      // However, since ngTools loader goes through a `transpileModule` before returning it get's
      // some fine-tuning from typescript, for example removing unused imports,
      // To make both identical we pass ngc-webpack transformer output through `transpileModule` as well.
      const result = ts.transpileModule(compiled[key], {
        compilerOptions: Object.assign({}, tsConfig, {
          removeComments: true
        }),
        fileName: Path.join(srcFileDir, key.replace('.js', '.ts'))
      });

      /* NOTE: Constructor's design:paramtypes

       For each class, the emitted "design:paramtypes" (`__metadata("design:paramtypes"...`) of ngTools
       loader will be different from the emitted code produced by ngc-webpack transformer.

       ngTools loader output treats each symbol as if it's not "sure" what it is (TS "unkonwon" symbol).
       It looks something like this:
       __metadata("design:paramtypes", [typeof (_a = typeof ChangeDetectorRef !== "undefined" && ChangeDetectorRef) === "function" && _a || Object])

       ngc-webpack transformer output will return:
       __metadata("design:paramtypes", [ChangeDetectorRef])

       The difference exists because of the different approaches in the transpilation chain between
       both libraries:

       ngTools loader does both AOT code transformation and TS to JS code compilation.
       The compilation is done via `transpileModule` which is a per module transpilation so external
       type information is limited so TS will mark all symbols as "unknown" and output a "guarded"
       version of metadata paramtype assignment code.

       ngc-webpack, like ngTools, does the AOT code transformation but it does not do TS to JS compilation.
       This is delegated to the next loader in chain that is responsible to do TS compilation.
       These loaders (e.g awesome-typescript-loader) does does not treat as file as standalone module
       but as a part of a program, i.e. typescript `Program`. This means that the type system is fully
       loaded thus symbol are fully resolved. When TS transpiles the code to JS it knows the Symbols
       so it will output a direct version of metadata paramtype assignment code, without guards.
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

         Both issues above does not effect runtime logic.
         #1 is just overriding the same function.
         #2 is just sending undefined to teh metadata registry.
         And does not effect semantics since the loader emits JS directly.

         However, since ngc-webpack transformer (and loader) emit TypeScript code they can't emit
         duplicate methods (#1) and can't emit non-value assignments (#2).

         This creates a different in the output that requires a fix, we post-fix the ngTools output
         to match the test.

         We match with specific constraints so it does not create false positive testing
       */

      if (key === 'service.js') {
        for (let i=0; i<ngToolsSource.length; i++) {

          // FIX: Constructor's design:paramtypes
          if (ngToolsSource[i].startsWith('        __metadata("design:paramtypes", [') && ngToolsSource[i].includes('typeof MyType !== "undefined"')) {

            // since the ngTools loader uses OnDestroy as a value it does no
            if (ngToolsSource[1] === `import { InjectionToken, OnDestroy } from '@angular/core';`) {
              ngToolsSource[1] = `import { InjectionToken } from '@angular/core';`;
            }

            let line = ngToolsSource[i].substr('        __metadata("design:paramtypes", ['.length);
            line = line.substr(0, line.length -2); // remove closing ])
            const params = line.split(',').map(p => {
              p = p.trim();
              if (p.startsWith('typeof')) {
                p = p.match(/typeof \(_.\s=\stypeof\s(.+)\s!==\s"undefined"/)[1];
              }
              return p;
            });

            // guard against test code changes...
            expect(params).to.deep.equal(['Object', 'MyType', 'Object', 'OnDestroy']);

            // the transformer should conver all of the types to "Object" since they are not values.
            ngToolsSource[i] = '        __metadata("design:paramtypes", [Object, Object, Object, Object])';
            ngToolsSource.splice(i+3, 1); // remove var _a, _b;
          }

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
          }
        }
      }

      else if (key === 'component.js') {
        for (let i=0; i<ngToolsSource.length; i++) {

          // FIX: Constructor's design:paramtypes
          if (ngToolsSource[i].startsWith('        __metadata("design:paramtypes", [') && ngToolsSource[i].includes('typeof ChangeDetectorRef !== "undefined"')) {
            let line = ngToolsSource[i].substr('        __metadata("design:paramtypes", ['.length);
            line = line.substr(0, line.length -2); // remove closing ])
            const params = line.split(',').map(p => {
              p = p.trim();
              if (p.startsWith('typeof')) {
                p = p.match(/typeof \(_.\s=\stypeof\s(.+)\s!==\s"undefined"/)[1];
              }
              return p;
            });

            // guard against test code changes...
            expect(params).to.deep.equal(['Object', 'ChangeDetectorRef', 'ViewContainerRef', 'Object', 'Http']);

            // the transformer should conver all of the types to "Object" since they are not values.
            ngToolsSource[i] = '        __metadata("design:paramtypes", [Object, ChangeDetectorRef,\n            ViewContainerRef, Object, Http])';
            ngToolsSource.splice(i+3, 1); // remove var _a, _b, _c;
          }

          // FIX #2
          if (ngToolsSource[i].startsWith('    MyComponentComponent.ctorParameters = function ()')) {
            const row = ngToolsSource.splice(i, 1)[0];
            ngToolsSource.pop();
            ngToolsSource.push(row.replace('MyInterface', 'Object').trim());
            ngToolsSource.push('');
          }
        }
      }

      else if (key === 'base-component.js') {
        for (let i=0; i<ngToolsSource.length; i++) {

          // FIX: Constructor's design:paramtypes
          if (ngToolsSource[i].startsWith('        __metadata("design:paramtypes", [') && ngToolsSource[i].includes('typeof ChangeDetectorRef !== "undefined"')) {
            let line = ngToolsSource[i].substr('        __metadata("design:paramtypes", ['.length);
            line = line.substr(0, line.length -2); // remove closing ])
            const params = line.split(',').map(p => {
              p = p.trim();
              if (p.startsWith('typeof')) {
                p = p.match(/typeof \(_.\s=\stypeof\s(.+)\s!==\s"undefined"/)[1];
              }
              return p;
            });

            // guard against test code changes...
            expect(params).to.deep.equal(['Object', 'ChangeDetectorRef']);

            // the transformer should conver all of the types to "Object" since they are not values.
            ngToolsSource[i] = '        __metadata("design:paramtypes", [Object, ChangeDetectorRef])';
            ngToolsSource.splice(i+3, 1); // remove var _a, _b;
          }
        }
      }

      expect(ngToolsSource.join('\n')).to.equal(result.outputText);
    })
  });

});