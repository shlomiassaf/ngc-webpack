#!/usr/bin/env node

import * as Path from 'path';
import * as FS from 'fs';
import * as minimist from 'minimist';
import * as resolve from 'resolve';
import { Configuration } from 'webpack';
import { NgCliWebpackConfig as _NgCliWebpackConfig } from '@angular/cli';
import { runCli } from './cli';
import { ParsedDiagnostics } from './util';
import { promisify, promiseWrapper } from '../utils';

function freezeStdout(): () => void {
  const old_stdout_write = process.stdout.write,
    old_stderr_write = process.stderr.write,
    old_console_error = console.error;

  process.stdout.write = (...args: any[]) => true;
  process.stderr.write = (...args: any[]) => true;
  console.error = (...args: any[]) => {};

  return () => {
    process.stdout.write = old_stdout_write;
    process.stderr.write = old_stderr_write;
    console.error = old_console_error;
  };
}

function tryFindNgScript(): Promise<string> {
  return promisify<string, resolve.AsyncOpts, string>(resolve)('@angular/cli', { basedir: process.cwd() })
    .then( resolvedPath => {
      let value = resolvedPath;
      const root = Path.parse(value).root;
      while (value !== root) {
        const base = Path.basename(value);
        if (base  === 'node_modules') {
          if (FS.existsSync(Path.resolve(value, '.bin/ng'))) {
            return Path.resolve(value, '.bin/ng');
          }
        } else if (base === '') {
          break;
        }
        else {
          value = Path.dirname(value);
        }
      }
      throw new Error(`Could not find ng script (starting at: ${resolvedPath}`);
    });
}

function hijackCliConfiguration(): Promise<Configuration> {
  const promise = promiseWrapper<Configuration>();
  const state = {
    config: undefined as Configuration,
    err: undefined as Error,
    unfreeze: undefined as () => void
  };

  const processExit = process.exit;
  process.exit = <any> function (code?: number): void {
    process.exit = processExit;
    if (state.config) {
      if (state.unfreeze) {
        state.unfreeze();
        delete state.unfreeze;
      }
      // error thrown to cancel cli work, suppress it and revert.
      promise.resolve(state.config);
    } else {
      const e = state.err || new Error('Invalid state, integration between ngc-webpack and @angular/cli failed.');
      promise.reject(e);
    }
  };

  promisify<string, resolve.AsyncOpts, string>(resolve)('@angular/cli/models/webpack-config.js', { basedir: process.cwd() })
    .then( value => {
      const NgCliWebpackConfig: typeof _NgCliWebpackConfig = require(value).NgCliWebpackConfig;

      const buildConfig = NgCliWebpackConfig.prototype.buildConfig;
      NgCliWebpackConfig.prototype.buildConfig = function(...args) {
        state.config = buildConfig.apply(this, args);
        state.unfreeze = freezeStdout();
        throw new Error('suppressed error');
      };

      return tryFindNgScript().then( ngScriptPath => require(ngScriptPath) );
    })
    .catch( err => {
      state.err = err;
      process.exit();
    });

  return promise.promise;
}

/**
 * Run `ngc-webpack` in library mode (i.e. run `ngc`) using `@angular/cli` (ng) configuration.
 * The cli is used to create a live instance of the webpack configuration, from there it is the same process as [[runCli]]
 *
 * `tsconfig` json path is taken from the options of AngularCompilerPlugin
 *
 * > This is not recommended, you would normally want to provide your own tsconfig with proper `angularCompilerOptions`.
 */
export function runNgCli(): Promise<ParsedDiagnostics>;
/**
 * Run `ngc-webpack` in library mode (i.e. run `ngc`) using `@angular/cli` (ng) configuration.
 * The cli is used to create a live instance of the webpack configuration, from there it is the same process as [[runCli]]
 *
 * `tsconfig` json path is taken from cli parameters (-p or --project) or, if not exists the options of
 * AngularCompilerPlugin
 *
 * @param cliParams cli Parameters, parsedArgs is not mandatory
 */
export function runNgCli(cliParams: { args: string[], parsedArgs?: minimist.ParsedArgs }): Promise<ParsedDiagnostics>;
/**
 * Run `ngc-webpack` in library mode (i.e. run `ngc`) using `@angular/cli` (ng) configuration.
 * The cli is used to create a live instance of the webpack configuration, from there it is the same process as [[runCli]]
 *
 * `tsconfig` json path is taken from the supplied tsConfigPath parameter.
 *
 * @param {string} tsConfigPath
 * @param cliParams cli Parameters, parsedArgs is not mandatory
 */
export function runNgCli(tsConfigPath: string,
                         cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): Promise<ParsedDiagnostics>;
export function runNgCli(tsConfigPath?: any,
                         cliParams?: { args: string[], parsedArgs?: minimist.ParsedArgs }): Promise<ParsedDiagnostics> {
  const p = hijackCliConfiguration();
  return p.then( (webpackConfig) => runCli(webpackConfig, tsConfigPath, cliParams) );
}


if (require.main === module) {
  const args: string[] = process.argv.slice(2);
  const parsedArgs = minimist(args);

  // p or project is not part of angular cli
  if ('p' in parsedArgs) {
    process.argv.splice(process.argv.indexOf('-p'), 2);
  }
  if ('project' in parsedArgs) {
    process.argv.splice(process.argv.indexOf('--project'), 2);
  }

  runNgCli({ args, parsedArgs })
    .then( parsedDiagnostics => {
      if (parsedDiagnostics.error) {
        throw parsedDiagnostics.error;
      }
    })
    .catch( err => {
      console.error(err);
      process.exit(1);
    });
}
