import { AngularCompilerPlugin } from '@ngtools/webpack';

import { NgcWebpackPluginOptions } from './plugin-options'
import { isValidAngularCompilerPlugin } from './utils';
import { NgcCompilerExecutionHost, MonkeyAngularCompilerPlugin, MonkeyWebpackCompilerHost } from './execution-models';


export function createAngularCompilerPluginExecutionHost(options: NgcWebpackPluginOptions): NgcCompilerExecutionHost {
  const ngPlugin: MonkeyAngularCompilerPlugin = <any> new AngularCompilerPlugin(options);

  if (!isValidAngularCompilerPlugin(ngPlugin)) {
    throw new Error('The "@ngtools/webpack" package installed is not compatible with this ' +
      'version of "ngc-webpack"');
  }

  // we must use the base instance because AngularCompilerPlugin use it.
  const compilerHost = ngPlugin._compilerHost;

  Object.defineProperty(compilerHost, 'resourceLoader', {
    get: function(this: MonkeyWebpackCompilerHost) {
      return this._resourceLoader;
    }
  });

  return {
    execute(compiler: any): void {
      ngPlugin.apply(compiler);
    },
    compilerHost,
    transformers: ngPlugin._transformers,
    hookOverride: {
      readFileTransformer: readFileTransformer => {
        const orgReadFile = compilerHost.readFile;
        const { predicate, transform } = readFileTransformer;
        const predicateFn = typeof predicate === 'function'
          ? predicate
          : (fileName: string) => predicate.test(fileName)
        ;

        Object.defineProperty(compilerHost, 'readFile', {
          value: function(this: MonkeyWebpackCompilerHost, fileName: string): string {
            if (predicateFn(fileName)) {
              let stats = compilerHost._files[fileName];
              if (!stats) {
                const content = transform(fileName, orgReadFile.call(compilerHost, fileName));
                stats = compilerHost._files[fileName];
                if (stats) {
                  stats.content = content;
                }
                return content;
              }
            }
            return orgReadFile.call(compilerHost, fileName);
          }
        });
      }
    }
  }
}
