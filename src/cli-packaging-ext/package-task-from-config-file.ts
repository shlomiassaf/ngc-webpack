import * as webpack from 'webpack';
import * as ts from 'typescript';
import * as minimist from 'minimist';

import { parseDiagnostics, CompilationResult } from '../cli/util';
import { createBuildTaskDefinitions, _createBuildTask } from '../cli/build-task';

import {
  tempTsConfigFactory,
  ConfigFileInfo,
  ConfigFileBuildTask
} from '../cli/config-file';
import { PackagedBuildConfig, loadFromFile, load } from './schema';
import { runTasks, TaskPhaseEvent } from './tasks';

export interface PackageBuildTask extends ConfigFileBuildTask {
  run: (progress?: (event: TaskPhaseEvent) => void) => Promise<CompilationResult>;
}

function applyTsConfigDefaultsForPackage(tsConfig: any): void {
  // default behaviour...
  const DefaultCompilerOptions: ts.CompilerOptions = {
    sourceMap: true
  };

  // mandatory behaviour
  const OverwriteCompilerOptions: ts.CompilerOptions = {
    declaration: true,
    listEmittedFiles: true
  };

  // mandatory if source maps...
  const SourceMapCompilerOptions: ts.CompilerOptions = {
    sourceMap: false,
    inlineSourceMap: true,
    inlineSources: true,
  };

  const { compilerOptions } = tsConfig;

  Object.keys(DefaultCompilerOptions).forEach( k => {
    if (!compilerOptions.hasOwnProperty(k)) {
      compilerOptions[k] = DefaultCompilerOptions[k];
    }
  });

  // if user chose to apply source maps, apply it to play nice with bundling.
  // we inline all sources into the files so rollup and sorcery will be happy
  if (compilerOptions.sourceMap || compilerOptions.inlineSourceMap) {
    Object.assign(compilerOptions, SourceMapCompilerOptions);
  }

  Object.assign(compilerOptions, OverwriteCompilerOptions);

}

export function createPackageTaskFromConfigFile(webpackConfig: string | webpack.Configuration,
                                                packageInfo: ConfigFileInfo): PackageBuildTask[];

export function createPackageTaskFromConfigFile(webpackConfig: string | webpack.Configuration,
                                                packageInfo: ConfigFileInfo,
                                                cliParams: { args: string[], parsedArgs?: minimist.ParsedArgs }): PackageBuildTask[];

export function createPackageTaskFromConfigFile(webpackConfig: string | webpack.Configuration,
                                                packageInfo: ConfigFileInfo,
                                                tsConfigPath: string,
                                                cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): PackageBuildTask[];

export function createPackageTaskFromConfigFile(webpackConfig: string | webpack.Configuration,
                                                packageInfo: ConfigFileInfo,
                                                tsConfigPath?: any,
                                                cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): PackageBuildTask[] {

  const taskDefinitions = createBuildTaskDefinitions(webpackConfig, tsConfigPath, cliParams);

  const { error, createTsConfig } = tempTsConfigFactory(taskDefinitions.tsConfigPath, applyTsConfigDefaultsForPackage);
  if (error) {
    return [ { run: () => Promise.resolve(parseDiagnostics([error], undefined)) } ];

  }

  // build with config file:
  const buildConfigs: Array<PackagedBuildConfig> = typeof packageInfo === 'string'
    ? loadFromFile(packageInfo)
    : load(packageInfo.baseDir, packageInfo.libraryBuildMeta)
  ;

  const runTasksWrapper = async (buildConfig: PackagedBuildConfig, progress?: (event: TaskPhaseEvent) => void) => {
    return await runTasks(buildConfig,
      () => {
        buildConfig.compilerOptions = Object.assign(buildConfig.compilerOptions || {}, { target: 'ES2015'} );
        taskDefinitions.tsConfigPath = createTsConfig(buildConfig);
        return _createBuildTask(taskDefinitions).run();
      },
      () => {
        buildConfig.compilerOptions = Object.assign(buildConfig.compilerOptions || {}, { target: 'es5'} );
        taskDefinitions.tsConfigPath = createTsConfig(buildConfig);
        return _createBuildTask(taskDefinitions).run();
      },
      progress
    );
  };

  return buildConfigs.map ( buildConfig => {
    const run = async (progress?: (event: TaskPhaseEvent) => void) => {

      const result = await runTasksWrapper(buildConfig, progress);

      if (buildConfig.secondary) {
        for (let secondaryBuildConfig of buildConfig.secondary) {
          await runTasksWrapper(secondaryBuildConfig, progress);
        }
      }
      return result;
    };

    return { run, buildConfig };
  });
}
