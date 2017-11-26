import * as Path from 'path';
import * as webpack from 'webpack';
import * as minimist from 'minimist';
import { AngularCompilerPlugin, AngularCompilerPluginOptions } from '@ngtools/webpack';

import { NgcWebpackPlugin } from '../plugin';
import { readNgcCommandLineAndConfiguration } from './config';
import { parseDiagnostics, CompilationResult } from './util';
import { asyncNgcExecutionHostFactory } from './ngc-execution-host';

/**
 * A build task ready to run, unless it has errors.
 */
export interface BuildTask {
  run: () => Promise<CompilationResult>;
}

/**
 * Information required to create a build task
 */
export interface BuildTaskDefinitions {
  /**
   * The path to the tsconfig used to compile.
   */
  tsConfigPath: string;
  /**
   * CLI Arguments
   */
  args: string[];
  /**
   * CLI arguments parsed by minimist
   */
  parsedArgs: minimist.ParsedArgs;
  /**
   * The webpack configuration object
   */
  webpackConfig: any;
  /**
   * Information about the AOT compiler plugin defined in the webpack configuration.
   */
  pluginMeta: {
    idx: number;
    instance: AngularCompilerPlugin | NgcWebpackPlugin;
    options: AngularCompilerPluginOptions;
  };
}

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

function getPluginMeta(plugins: any[]) {
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

export function findPluginIndex(plugins: any[], type: any): number {
  return plugins.findIndex( p => p instanceof type);
}

/**
 * Creates definitions required for a build task.
 * This functions normalized inputs into defined instructions.
 * @param webpackConfig
 * @param tsConfigPath
 * @param cliParams
 */
export function createBuildTaskDefinitions(webpackConfig: string | webpack.Configuration,
                                           tsConfigPath?: any,
                                           cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): BuildTaskDefinitions {
  // normalize params:
  if (tsConfigPath && typeof tsConfigPath !== 'string') {
    cliParams = <any> tsConfigPath;
    tsConfigPath = undefined;
  }
  if (!cliParams) {
    cliParams = {args: [], parsedArgs: <any> {}};
  } else if (!cliParams.parsedArgs) {
    cliParams.parsedArgs = minimist(cliParams.args);
  }
  const {args, parsedArgs} = cliParams;

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

  return {
    tsConfigPath,
    args,
    parsedArgs,
    webpackConfig: configModule,
    pluginMeta
  }
}

/**
 * Creates a build task from build task definitions.
 * @internal
 */
export function _createBuildTask(defs: BuildTaskDefinitions): BuildTask {
  defs.pluginMeta.options.tsConfigPath = defs.tsConfigPath;
  normalizeProjectParam(defs.tsConfigPath, defs.args, defs.parsedArgs);
  const config = readNgcCommandLineAndConfiguration(defs.args, defs.parsedArgs);

  if (config.errors && config.errors.length > 0) {
    return { run: () => Promise.resolve(parseDiagnostics(config.errors, undefined)) };
  } else {
    return {
      run: () => {
        /*
          Because we are using webpack API to execute (`plugin.apply(compiler)`), the execution response is hidden.
          To play nice with webpack, instead of changing execute to return a promise we wrap the whole execute function
          and provide a notification
        */
        const { executeDone, executionHostFactory } = asyncNgcExecutionHostFactory(config);
        const plugin = new NgcWebpackPlugin(defs.pluginMeta.options, executionHostFactory);
        const compiler = webpack(defs.webpackConfig);
        plugin.apply(compiler);
        return executeDone
      }
    };
  }
}

/**
 * Creates a task for running `ngc-webpack` in library mode. (i.e. run `ngc`)
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
export function createBuildTask(webpackConfig: string | webpack.Configuration): BuildTask;
/**
 * Creates a task for running `ngc-webpack` in library mode. (i.e. run `ngc`)
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
export function createBuildTask(webpackConfig: string | webpack.Configuration,
                                cliParams: { args: string[], parsedArgs?: minimist.ParsedArgs }): BuildTask;
/**
 * Creates a task for running `ngc-webpack` in library mode. (i.e. run `ngc`)
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
export function createBuildTask(webpackConfig: string | webpack.Configuration,
                                tsConfigPath: string,
                                cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): BuildTask;
export function createBuildTask(webpackConfig: string | webpack.Configuration,
                                tsConfigPath?: any,
                                cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): BuildTask {
  // normalize params:
  const taskDefinitions = createBuildTaskDefinitions(webpackConfig, tsConfigPath, cliParams);
  return _createBuildTask(taskDefinitions);
}
