import * as FS from 'fs';
import * as Path from 'path';
import * as webpack from 'webpack';
import * as minimist from 'minimist';
import * as ts from 'typescript';
import * as tmp from 'tmp';

import { parseDiagnostics } from '../util';
import { BuildTask, createBuildTaskDefinitions, _createBuildTask } from '../build-task';
import { BuildConfig, LibraryBuildMeta, load, loadFromFile } from './schema';

/**
 * A build task based on a config file
 */
export interface ConfigFileBuildTask extends BuildTask {
  buildConfig?: BuildConfig;
}

/**
 * A file path to the config file of the raw data of the config file.
 *
 */
export type ConfigFileInfo = string | { baseDir: string, libraryBuildMeta: LibraryBuildMeta | LibraryBuildMeta[] };

/**
 * A factory that for a temporary tsconfig generator function that will generate a tsconfig based on a [[BuildConfig]].
 * The tsconfig internal data is unique for every call.
 *
 * If an error occur while loading the tsconfig the error property is populated otherwise the createTsConfig is set.
 *
 * @param baseTsConfigPath the path to the tsconfig to use as base.
 * @param processBase an optional hooks to process the base tsconfig
 */
export function tempTsConfigFactory(baseTsConfigPath: string,
                                    processBase?: (tsConfig: any) => void): {
  error?: ts.Diagnostic,
  createTsConfig?: (buildConfig: BuildConfig) => string
} {
  const tsConfigDir = Path.dirname(baseTsConfigPath);
  const tsConfigReadResult = ts.readConfigFile(baseTsConfigPath, ts.sys.readFile);
  if (tsConfigReadResult.error) {
    return { error: tsConfigReadResult.error };
  }

  if (typeof processBase === 'function') {
    processBase(tsConfigReadResult.config);
  }
  // quick and dumb clone
  const tsConfigSerialized = JSON.stringify(tsConfigReadResult.config);
  return {
    createTsConfig: (buildConfig: BuildConfig) => {
      const tsConfig = JSON.parse(tsConfigSerialized);
      tmp.setGracefulCleanup();
      const tmpTsConfig = tmp.fileSync({discardDescriptor: true, dir: tsConfigDir, postfix: '.tsconfig.json'});
      buildConfig.updateTsConfig(tsConfigDir, tsConfig);
      FS.writeFileSync(tmpTsConfig.name, JSON.stringify(tsConfig), {encoding: 'utf-8'});
      return tmpTsConfig.name;
    }
  }
}

/**
 * Creates a task for running `ngc-webpack` in library mode using a build configuration file
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
export function createBuildTaskFromConfigFile(webpackConfig: string | webpack.Configuration,
                                              packageInfo: ConfigFileInfo): ConfigFileBuildTask[];
/**
 * Creates a task for running `ngc-webpack` in library mode using a build configuration file
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
export function createBuildTaskFromConfigFile(webpackConfig: string | webpack.Configuration, packageInfo: ConfigFileInfo,
                                              cliParams: { args: string[], parsedArgs?: minimist.ParsedArgs }): ConfigFileBuildTask[];
/**
 * Creates a task for running `ngc-webpack` in library mode using a build configuration file
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
export function createBuildTaskFromConfigFile(webpackConfig: string | webpack.Configuration, packageInfo: ConfigFileInfo,
                                              tsConfigPath: string,
                                              cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): ConfigFileBuildTask[];
export function createBuildTaskFromConfigFile(webpackConfig: string | webpack.Configuration, packageInfo: ConfigFileInfo,
                                              tsConfigPath?: any,
                                              cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): ConfigFileBuildTask[] {
  const taskDefinitions = createBuildTaskDefinitions(webpackConfig, tsConfigPath, cliParams);

  const { error, createTsConfig } = tempTsConfigFactory(taskDefinitions.tsConfigPath);
  if (error) {
    return [ { run: () => Promise.resolve(parseDiagnostics([error], undefined)) } ];

  }

  // build with config file:
  const buildConfigs: Array<BuildConfig> = typeof packageInfo === 'string'
    ? loadFromFile(packageInfo)
    : load(packageInfo.baseDir, packageInfo.libraryBuildMeta)
  ;

  return buildConfigs.map ( buildConfig => {
    taskDefinitions.tsConfigPath = createTsConfig(buildConfig);
    const { run } = _createBuildTask(taskDefinitions);
    return {
      run,
      buildConfig
    };
  });
}
