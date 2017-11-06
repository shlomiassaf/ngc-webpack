import { AngularCompilerPlugin } from '@ngtools/webpack';

import { NgcWebpackPluginOptions } from './plugin-options'
import { MonkeyAngularCompilerPlugin } from './monkies';
import { hasHook, withHook, isValidAngularCompilerPlugin } from './utils';
import { WebpackResourceLoader } from './resource-loader';

export class NgcWebpackPlugin {
  private ngcWebpackPluginOptions: NgcWebpackPluginOptions;
  private angularCompilerPlugin: MonkeyAngularCompilerPlugin;
  private valid: boolean;

  constructor(options: NgcWebpackPluginOptions) {
    if (options.hasOwnProperty('AOT')) {
      if (!options.hasOwnProperty('skipCodeGeneration')) {
        options.skipCodeGeneration = !options.AOT;
      }
      delete options.AOT;
    }

    this.ngcWebpackPluginOptions = options;
    this.angularCompilerPlugin = <any> new AngularCompilerPlugin(options);

    this.valid = isValidAngularCompilerPlugin(this.angularCompilerPlugin);
    if (!this.valid) {
      throw new Error('The "@ngtools/webpack" package installed is not compatible with this ' +
        'version of "ngc-webpack"');
    }
  }

  apply(compiler: any) {
    if (!this.valid) {
      return;
    }

    const ngcOptions = this.ngcWebpackPluginOptions;
    const ngPlugin = this.angularCompilerPlugin;
    const compilerHost = ngPlugin._compilerHost;

    withHook(ngcOptions, 'beforeRun', beforeRun => {
      compiler.plugin('run', (compiler, next) => {
        const webpackResourceLoader = new WebpackResourceLoader();
        webpackResourceLoader.update(compiler.createCompilation());
        Promise.resolve(beforeRun(webpackResourceLoader)).then(next).catch(next);
      } );
    });

    ngPlugin.apply(compiler);

    if (ngcOptions.tsTransformers) {
      if (ngcOptions.tsTransformers.before) {
        this.angularCompilerPlugin._transformers.push(...ngcOptions.tsTransformers.before);
      }
      if (ngcOptions.tsTransformers.after) {

      }
    }

    if (ngcOptions.readFileTransformer) {
      const orgReadFile = compilerHost.readFile;
      const { predicate, transform } = ngcOptions.readFileTransformer;
      const predicateFn = typeof predicate === 'function'
        ? predicate
        : (fileName: string) => predicate.test(fileName)
      ;

      compilerHost.readFile = (fileName: string): string => {
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
    }

    if (hasHook(ngcOptions, ['resourcePathTransformer', 'resourceTransformer']).some( v => v) ) {
      const resourceGet = compilerHost._resourceLoader.get;
      compilerHost._resourceLoader.get = (filePath: string): Promise<string> => {
        withHook(ngcOptions, 'resourcePathTransformer', resourcePath => {
          filePath = ngcOptions.resourcePathTransformer(filePath);
        });

        let p = resourceGet.call(compilerHost._resourceLoader, filePath);
        withHook(ngcOptions, 'resourceTransformer', resource => {
          p = p.then( content => Promise.resolve(resource(filePath, content)) );
        });
        return p;
      }
    }
  }
}