import * as Path from 'path';
import * as webpack from 'webpack';
import { ParsedArgs } from 'minimist';

import { NgcWebpackPlugin, NgcCompilerExecutionHost } from '../plugin';
import { NgcWebpackPluginOptions } from '../plugin-options';

import { readNgcCommandLineAndConfiguration, NgcParsedConfiguration } from './config';
import { parseDiagnostics, ParsedDiagnostics } from './util';
import { performCompilationAsync } from './perform_compile_async';
import { createCliContext } from './cli-context';

/**
 * Resolve the config to an object.
 * If it's a fn, invoke.
 *
 * Also check if it's a mocked ES6 Module in cases where TS file is used that uses "export default"
 * @param config
 * @returns {any}
 */
function resolveConfig(config: any): any {
  if (typeof config === 'function') {
    return config();
  } else if (config.__esModule === true && !!config.default) {
    return resolveConfig(config.default);
  } else {
    return config;
  }
}

export function findPluginIndex(plugins: any[]): number {
  return plugins.findIndex( p => p instanceof NgcWebpackPlugin);
}

function promiseWrapper<T>() {
  const wrapper: { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: any) => void } = <any> {};
  wrapper.promise = new Promise<T>( (res, rej) => { wrapper.resolve = res; wrapper.reject = rej; });
  return wrapper;
}


function createCliExecutionHostFactory(config: NgcParsedConfiguration): {
  createCliExecutionHost: (options: NgcWebpackPluginOptions) => NgcCompilerExecutionHost,
  compilationResult: Promise<ParsedDiagnostics>
} {
  const pWrap = promiseWrapper<ParsedDiagnostics>();

  return {
    compilationResult: pWrap.promise,
    createCliExecutionHost: (options: NgcWebpackPluginOptions): NgcCompilerExecutionHost => {
      const ctx = createCliContext(config);
      const { compilerHost } = ctx;

      const inline = config.options.skipTemplateCodegen;

      return {
        execute(compiler: any): void {
          const compilation = ctx.createCompilation(compiler);
          const rootNames = config.rootNames.slice();

          performCompilationAsync({
            rootNames,
            options: config.options,

            /*
                The compiler host "writeFile" is wrapped with a handler that will
                inline all resources into metadata modules (non flat bundle modules)
             */
            host: (inline && !config.options.skipMetadataEmit && !config.options.flatModuleOutFile)
              ? ctx.resourceInliningCompilerHost()
              : compilerHost
            ,
            emitFlags: config.emitFlags,
            // we use the compiler-cli emit callback but we wrap it so we can create a map of source file path to
            // output file path
            emitCallback: ctx.emitCallback,
            customTransformers: {
              beforeTs: inline ? [ ctx.createInlineResourcesTransformer() ] : []
            }
          })
            .then( result => {
              const parsedDiagnostics = parseDiagnostics(result.diagnostics, config.options);
              if (parsedDiagnostics.exitCode !== 0) {
                const error = parsedDiagnostics.error || new Error(parsedDiagnostics.exitCode.toString());
                compilation.errors.push(error);
              }

              // inline resources into the flat metadata json file, if exists.
              if (compilation.errors.length === 0 && config.options.flatModuleOutFile) {
                // TODO: check that it exists, config.rootNames should not have it (i.e. it was added to rootNames)
                const flatModulePath = rootNames[rootNames.length - 1];
                ctx.inlineFlatModuleMetadataBundle(Path.dirname(flatModulePath), config.options.flatModuleOutFile);
              }

              pWrap.resolve(parsedDiagnostics);
            } )
            .catch( err => pWrap.reject(err));
        },
        compilerHost,
        transformers: []
      }
    }
  }
}

export function runCli(webpackConfig: string | webpack.Configuration, args: string[], parsedArgs: ParsedArgs): Promise<ParsedDiagnostics> {
  return Promise.resolve<null>(null)
    .then( () => {
      if (typeof webpackConfig === 'string') {
        let configPath = Path.isAbsolute(webpackConfig)
          ? webpackConfig
          : Path.join(process.cwd(), webpackConfig)
        ;

        webpackConfig = require(configPath);
      }

      const configModule = resolveConfig(webpackConfig);
      const pluginIdx = findPluginIndex(configModule.plugins || []);


      if (pluginIdx === -1) {
        // TODO: allow running without a plugin and create it here?
        throw new Error('Could not find an instance of NgcWebpackPlugin in the provided webpack configuration');
      }

      // if tsconfig (p or project) is not set, set it from plugin
      if (!parsedArgs.p && !parsedArgs.project) {
        const oldPlugin = configModule.plugins[pluginIdx];
        parsedArgs.p = oldPlugin.tsConfigPath;
        args.push('-p', oldPlugin.tsConfigPath);
      }

      const config = readNgcCommandLineAndConfiguration(args, parsedArgs);

      if (config.errors.length) {
        return parseDiagnostics(config.errors, /*options*/ undefined);
      }

      const { compilationResult, createCliExecutionHost: executionHostFactory } = createCliExecutionHostFactory(config);
      const plugin = NgcWebpackPlugin.clone(configModule.plugins[pluginIdx], { executionHostFactory });
      configModule.plugins.splice(pluginIdx, 1);

      const compiler = webpack(configModule);
      plugin.apply(compiler);

      return compilationResult
    });

}
