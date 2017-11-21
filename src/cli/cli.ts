import * as Path from 'path';
import * as webpack from 'webpack';
import * as minimist from 'minimist';
import { AngularCompilerPlugin, AngularCompilerPluginOptions } from '@ngtools/webpack';

import { NgcWebpackPlugin, NgcCompilerExecutionHost } from '../plugin';
import { NgcWebpackPluginOptions } from '../plugin-options';
import { promiseWrapper } from '../utils';

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

export function findPluginIndex(plugins: any[], type: any): number {
  return plugins.findIndex( p => p instanceof type);
}

export function getPluginMeta(plugins: any[]): { idx: number, instance: AngularCompilerPlugin | NgcWebpackPlugin, options: AngularCompilerPluginOptions } {
  let idx = findPluginIndex(plugins, NgcWebpackPlugin);

  if (idx > -1) {
    return {
      idx,
      instance: plugins[idx],
      options: plugins[idx].ngcWebpackPluginOptions
    }
  }

  idx = findPluginIndex(plugins, AngularCompilerPlugin);
  if (idx > -1) {
    return {
      idx,
      instance: plugins[idx],
      options: plugins[idx].options
    }
  }

  // TODO: allow running without a plugin and create it here?
  throw new Error('Could not find an instance of NgcWebpackPlugin or AngularCompilerPlugin in the provided webpack configuration');
}


function normalizeProjectParam(tsConfigPath: string, args: string[], parsedArgs: any): void {
  const [ pIdx, projectIdx ] = [args.indexOf('-p'), args.indexOf('--project')];
  parsedArgs.p = tsConfigPath;
  if (pIdx > -1) {
    args[pIdx + 1] = tsConfigPath;
  } else {
    args.push('-p', tsConfigPath);
  }
  if (projectIdx > -1) {
    delete parsedArgs.project;
    args.splice(projectIdx, 1);
  }
}

function createCliExecutionHostFactory(config: NgcParsedConfiguration): {
  createCliExecutionHost: (options: NgcWebpackPluginOptions) => NgcCompilerExecutionHost,
  compilationResult: Promise<ParsedDiagnostics>
} {
  const pWrap = promiseWrapper<ParsedDiagnostics>();

  return {
    compilationResult: pWrap.promise,
    createCliExecutionHost: (options: NgcWebpackPluginOptions): NgcCompilerExecutionHost => {
      const inline = config.options.skipTemplateCodegen;
      if (config.options.skipTemplateCodegen && !config.options.fullTemplateTypeCheck) {
        /*
          Angular cli's compiler host will not generate metadata if skipping template codegen or no full template typescheck.
          See https://github.com/angular/angular/blob/master/packages/compiler-cli/src/transformers/compiler_host.ts#L440
          This is required if we want to inline the resources while compiling and not in post.

          To solve this we need to enforce `fullTemplateTypeCheck`:

          options.fullTemplateTypeCheck = true;

          but this has issues
          see issue: https://github.com/angular/angular/issues/19905
          which has pending PR to fix: https://github.com/angular/angular/pull/20490
          and also, dev's might want this off...

          current workaround will is to disable skipTemplateCodegen
          this looks weired because we want it on...
          but, at this point we have a config object (NgcParsedConfiguration) which is an angular-cli parsed config
          created by called `readNgcCommandLineAndConfiguration`.
          The config object has a property `emitFlags` which at this point has the flag `Codegen` OFF !!!
          OFF reflects config.options.skipTemplateCodegen = true.

          Setting `config.options.skipTemplateCodegen` to false, at this point, will not change the emitFlags.
          The compiler will NOT emit template code gen but the `isSourceFile` method in
          https://github.com/angular/angular/blob/master/packages/compiler-cli/src/transformers/compiler_host.ts#L440
          will return true!

          This is a weak workaround and a more solid one is required.

          TODO: refactor workaround to a writeFile wrapper that will not write generated files.
         */
        // options.fullTemplateTypeCheck = true;
        config.options.skipTemplateCodegen = false;
      }

      const ctx = createCliContext(config);
      const { compilerHost } = ctx;

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


/**
 * Run `ngc-webpack` in library mode. (i.e. run `ngc`)
 * In Library mode compilation and output is done per module and no bundling is done.
 * Webpack is used for resource compilation through it's loader chain but does not bundle anything.
 * The webpack configuration, excluding loaders, has no effect.
 * The webpack configuration must include a plugin instance (either  NgcWebpackPlugin / AngularCompilerPlugin).
 *
 * Library mode configuration is done mainly from the `tsconfig` json file.
 *
 * `tsconfig` json path is taken from the options of NgcWebpackPlugin / AngularCompilerPlugin
 *
 * @param webpackConfig Webpack configuration module, object or string
 */
export function runCli(webpackConfig: string | webpack.Configuration): Promise<ParsedDiagnostics>;
/**
 * Run `ngc-webpack` in library mode. (i.e. run `ngc`)
 * In Library mode compilation and output is done per module and no bundling is done.
 * Webpack is used for resource compilation through it's loader chain but does not bundle anything.
 * The webpack configuration, excluding loaders, has no effect.
 * The webpack configuration must include a plugin instance (either  NgcWebpackPlugin / AngularCompilerPlugin).
 *
 * Library mode configuration is done mainly from the `tsconfig` json file.
 *
 * `tsconfig` json path is taken from cli parameters (-p or --project) or, if not exists the options of
 * NgcWebpackPlugin / AngularCompilerPlugin
 *
 * @param webpackConfig Webpack configuration module, object or string,
 * @param cliParams cli Parameters, parsedArgs is not mandatory
 */
export function runCli(webpackConfig: string | webpack.Configuration,
                       cliParams: { args: string[], parsedArgs?: minimist.ParsedArgs }): Promise<ParsedDiagnostics>;
/**
 * Run `ngc-webpack` in library mode. (i.e. run `ngc`)
 * In Library mode compilation and output is done per module and no bundling is done.
 * Webpack is used for resource compilation through it's loader chain but does not bundle anything.
 * The webpack configuration, excluding loaders, has no effect.
 * The webpack configuration must include a plugin instance (either  NgcWebpackPlugin / AngularCompilerPlugin).
 *
 * Library mode configuration is done mainly from the `tsconfig` json file.
 *
 * `tsconfig` json path is taken from the supplied tsConfigPath parameter.
 *
 * @param webpackConfig Webpack configuration module, object or string,
 * @param tsConfigPath path to the tsconfig file, relative to process.cwd()
 * @param cliParams cli Parameters, parsedArgs is not mandatory
 */
export function runCli(webpackConfig: string | webpack.Configuration,
                       tsConfigPath: string,
                       cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): Promise<ParsedDiagnostics>;
export function runCli(webpackConfig: string | webpack.Configuration,
                       tsConfigPath?: any,
                       cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): Promise<ParsedDiagnostics> {
  return Promise.resolve<null>(null)
    .then( () => {
      // normalize params:
      if (tsConfigPath && typeof tsConfigPath !== 'string') {
        cliParams = <any> tsConfigPath;
        tsConfigPath = undefined;
      }
      if (!cliParams) {
        cliParams = { args: [], parsedArgs: <any> {} };
      } else if (!cliParams.parsedArgs) {
        cliParams.parsedArgs = minimist(cliParams.args);
      }
      const { args, parsedArgs } = cliParams;

      if (typeof webpackConfig === 'string') {
        let configPath = Path.isAbsolute(webpackConfig)
          ? webpackConfig
          : Path.join(process.cwd(), webpackConfig)
        ;

        webpackConfig = require(configPath);
      }

      const configModule = resolveConfig(webpackConfig);
      const pluginMeta = getPluginMeta(configModule.plugins || []);

      if (!tsConfigPath) {
        tsConfigPath = parsedArgs.p || parsedArgs.project || pluginMeta.options.tsConfigPath;
      }
      if (!tsConfigPath) {
        throw new Error('Invalid configuration, please set tsconfig path in cli params -p or --project or in NgcWebpackPlugin configuration');
      }
      pluginMeta.options.tsConfigPath = tsConfigPath;
      normalizeProjectParam(tsConfigPath, args, parsedArgs);

      const config = readNgcCommandLineAndConfiguration(args, parsedArgs);

      if (config.errors.length) {
        return parseDiagnostics(config.errors, /*options*/ undefined);
      }

      const { compilationResult, createCliExecutionHost: executionHostFactory } = createCliExecutionHostFactory(config);
      const plugin = new NgcWebpackPlugin(pluginMeta.options, executionHostFactory);
      configModule.plugins.splice(pluginMeta.idx, 1);

      const compiler = webpack(configModule);
      plugin.apply(compiler);

      return compilationResult
    });

}


if (require.main === module) {
  const args: string[] = process.argv.slice(2);
  const parsedArgs = minimist(args);

  const webpackConfig = parsedArgs.webpack;

  if (!webpackConfig) {
    throw new Error('Missing webpack argument');
  }

  delete parsedArgs.webpack;
  args.splice(args.indexOf('--webpack'), 2);

  runCli(webpackConfig, { args, parsedArgs })
    .then( parsedDiagnostics => {
      if (parsedDiagnostics.error) {
        console.error(parsedDiagnostics.error);
      }
      process.exit(parsedDiagnostics.exitCode);
    });
}
