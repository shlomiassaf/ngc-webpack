import * as ts from 'typescript';
import { AngularCompilerPlugin } from '@ngtools/webpack';

import { NgcWebpackPluginOptions } from './plugin-options'
import { hasHook, withHook, isValidAngularCompilerPlugin } from './utils';
import { WebpackResourceLoader } from './resource-loader';
import { MonkeyAngularCompilerPlugin, MonkeyWebpackCompilerHost } from './monkies';

export interface NgcCompilerHost extends ts.CompilerHost {
  resourceLoader?: { get(filePath: string): Promise<string> };
  readResource?(fileName: string): Promise<string> | string;
}

export interface NgcCompilerExecutionHost {
  execute(compiler: any): void;
  compilerHost: NgcCompilerHost;
  transformers: ts.TransformerFactory<ts.SourceFile>[];
  hookOverride?: {
    [K in keyof NgcWebpackPluginOptions]?: (opt: NgcWebpackPluginOptions[K]) => void
  }
}

export function createAngularCompilerPluginExecutionHost(options: NgcWebpackPluginOptions): NgcCompilerExecutionHost {
  const ngPlugin: MonkeyAngularCompilerPlugin = <any> new AngularCompilerPlugin(options);

  if (!isValidAngularCompilerPlugin(ngPlugin)) {
    throw new Error('The "@ngtools/webpack" package installed is not compatible with this ' +
      'version of "ngc-webpack"');
  }

  const properties: Partial<Record<keyof NgcCompilerHost, PropertyDescriptor>> = {
    resourceLoader: {
      get: function() { return this._resourceLoader }
    }
  };

  const compilerHost = Object.create(ngPlugin._compilerHost, properties);

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

        compilerHost.readFile = (fileName: string): string => {
          if (predicateFn(fileName)) {
            let stats = ngPlugin._compilerHost._files[fileName];
            if (!stats) {
              const content = transform(fileName, orgReadFile.call(compilerHost, fileName));
              stats = ngPlugin._compilerHost._files[fileName];
              if (stats) {
                stats.content = content;
              }
              return content;
            }
          }
          return orgReadFile.call(compilerHost, fileName);
        }
      }
    }
  }
}

export class NgcWebpackPlugin {
  private ngcWebpackPluginOptions: NgcWebpackPluginOptions;
  private executionHostFactory: (options: NgcWebpackPluginOptions) => NgcCompilerExecutionHost;

  get tsConfigPath(): string {
    return this.ngcWebpackPluginOptions.tsConfigPath;
  }

  constructor(options: NgcWebpackPluginOptions,
              executionHostFactory: (options: NgcWebpackPluginOptions) => NgcCompilerExecutionHost = createAngularCompilerPluginExecutionHost) {
    if (options.hasOwnProperty('AOT')) {
      if (!options.hasOwnProperty('skipCodeGeneration')) {
        options.skipCodeGeneration = !options.AOT;
      }
      delete options.AOT;
    }

    this.ngcWebpackPluginOptions = options;
    this.executionHostFactory = executionHostFactory;
  }

  apply(compiler: any) {
    const ngcOptions = this.ngcWebpackPluginOptions;
    const executionHost = this.executionHostFactory(this.ngcWebpackPluginOptions);
    const compilerHost = executionHost.compilerHost;

    withHook(ngcOptions, 'beforeRun', beforeRun => {
      let ran = false;
      const run = (cmp, next) => {
        if (ran) {
          next();
          return;
        }
        // for now, run once
        // TODO: add hook for watch mode to notify on watch-run
        ran = true;
        const webpackResourceLoader = new WebpackResourceLoader();
        webpackResourceLoader.update(compiler.createCompilation());
        Promise.resolve(beforeRun(webpackResourceLoader)).then(next).catch(next);
      };
      compiler.plugin('run', run);
      compiler.plugin('watch-run', run);
    });

    if (ngcOptions.readFileTransformer) {
      if (executionHost.hookOverride && executionHost.hookOverride.readFileTransformer) {
        executionHost.hookOverride.readFileTransformer(ngcOptions.readFileTransformer);
      } else {
        const orgReadFile = compilerHost.readFile;
        const { predicate, transform } = ngcOptions.readFileTransformer;
        const predicateFn = typeof predicate === 'function'
          ? predicate
          : (fileName: string) => predicate.test(fileName)
        ;

        compilerHost.readFile = (fileName: string): string => {
          const readFileResponse = orgReadFile.call(compilerHost, fileName);
          return predicateFn(fileName)
            ? transform(fileName, readFileResponse)
            : readFileResponse
            ;
        }
      }
    }

    if (ngcOptions.tsTransformers) {
      if (ngcOptions.tsTransformers.before) {
        executionHost.transformers.push(...ngcOptions.tsTransformers.before);
      }
      if (ngcOptions.tsTransformers.after) {

      }
    }

    if (hasHook(ngcOptions, ['resourcePathTransformer', 'resourceTransformer']).some( v => v) ) {
      const resourceGet = compilerHost.resourceLoader.get;
      compilerHost.resourceLoader.get = (filePath: string): Promise<string> => {
        withHook(ngcOptions, 'resourcePathTransformer', resourcePath => {
          filePath = ngcOptions.resourcePathTransformer(filePath);
        });

        let p = resourceGet.call(compilerHost.resourceLoader, filePath);
        withHook(ngcOptions, 'resourceTransformer', resource => {
          p = p.then( content => Promise.resolve(resource(filePath, content)) );
        });
        return p;
      }
    }

    executionHost.execute(compiler);
  }

  static clone(plugin: NgcWebpackPlugin,
               executionHostFactory?: (options: NgcWebpackPluginOptions) => NgcCompilerExecutionHost): NgcWebpackPlugin {
    return new NgcWebpackPlugin(plugin.ngcWebpackPluginOptions, executionHostFactory || plugin.executionHostFactory);
  }
}