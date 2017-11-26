import * as resolve from 'resolve';
import { Configuration } from 'webpack';
import { NgCliWebpackConfig as _NgCliWebpackConfig } from '@angular/cli';
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

export function getCliConfiguration(): Promise<Configuration> {
  const promise = promiseWrapper<Configuration>();
  const state = {
    dispose: undefined as () => void,
    config: undefined as Configuration,
    err: undefined as Error,
    unfreeze: undefined as () => void
  };

  // it is expected to have ng-cli installed locally
  // TODO: proper error message if not
  Promise.all([
    promisify<string, resolve.AsyncOpts, string>(resolve)('@angular/cli', { basedir: process.cwd() }),
    promisify<string, resolve.AsyncOpts, string>(resolve)('@angular/cli/models/webpack-config.js', { basedir: process.cwd() })
  ])
    .then( ( [projectLocalCli, projectLocalWebpackConfig] ) => {
      let cli = require(projectLocalCli);
      if ('default' in cli) {
        cli = cli['default'];
      }
      const NgCliWebpackConfig: typeof _NgCliWebpackConfig = require(projectLocalWebpackConfig).NgCliWebpackConfig;

      const buildConfig = NgCliWebpackConfig.prototype.buildConfig;
      NgCliWebpackConfig.prototype.buildConfig = function(...args) {
        state.config = buildConfig.apply(this, args);
        state.unfreeze = freezeStdout();
        throw new Error('suppressed error');
      };
      // we create a dispose method so multi ng-cli process on the same session will work
      state.dispose = () => NgCliWebpackConfig.prototype.buildConfig = buildConfig;

      const events = require('events');
      let standardInput;
      try {
        standardInput = process.stdin;
      } catch (e) {
        delete process.stdin;
        process.stdin = new events.EventEmitter();
        standardInput = process.stdin;
      }

      return cli({
        cliArgs: process.argv.slice(2),
        inputStream: standardInput,
        outputStream: process.stdout
      })
    })
    .catch( err => state.err = err)
    .then( value => {
      if (state.dispose) {
        state.dispose();
      }
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
    });
  return promise.promise;
}
