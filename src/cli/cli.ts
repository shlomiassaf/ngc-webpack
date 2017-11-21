import * as Path from 'path';
import * as webpack from 'webpack';
import * as minimist from 'minimist';
import { AngularCompilerPlugin, AngularCompilerPluginOptions } from '@ngtools/webpack';

import { NgcWebpackPlugin } from '../plugin';

import { readNgcCommandLineAndConfiguration } from './config';
import { parseDiagnostics, ParsedDiagnostics } from './util';
import { asyncCliExecutionHostFactory } from './cli-execution-host';

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

      /*
      Because we are using webpack API to execute (`plugin.apply(compiler)`), the execution response is hidden.
      To play nice with webpack, instead of changing execute to return a promise we wrap the whole execute function
      and provide a notification
       */
      const { executeDone, executionHostFactory } = asyncCliExecutionHostFactory(config);


      const plugin = new NgcWebpackPlugin(pluginMeta.options, executionHostFactory);
      configModule.plugins.splice(pluginMeta.idx, 1);

      const compiler = webpack(configModule);
      plugin.apply(compiler);

      return executeDone
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
