#!/usr/bin/env node
require('ts-node/register');

import 'reflect-metadata';
import { main as tscWrappedMain, NgcCliOptions, UserError } from '@angular/tsc-wrapped';
import { SyntaxError } from '@angular/compiler' ;
import { CodeGenerator, CompilerHostContext } from '@angular/compiler-cli' ;

import { WebpackWrapper } from './webpack-wrapper';
import { WebpackChainModuleResolutionHostAdapter } from './webpack-chain-module-resolution-host-adapter';

function codeGenFactory(webpackWrapper: WebpackWrapper) {
  return (ngOptions, cliOptions, program, host) => {
    const hostContext: CompilerHostContext = new WebpackChainModuleResolutionHostAdapter(host, webpackWrapper);
    return CodeGenerator.create(ngOptions, cliOptions, program, host, hostContext).codegen();
  }
}

export function runInternal(project: string, cliOptions: NgcCliOptions, webpack: WebpackWrapper): Promise<any> {
  return tscWrappedMain(project, cliOptions, codeGenFactory(webpack))
    .then( () => webpack.emitOnCompilationSuccess() )
    .catch(e => {
      webpack.emitOnCompilationError(e);
      throw e;
    });
}

export let run = runInternal;

export function main(args: any, consoleError: (s: string) => void = console.error) {
  run = ( () => {
    return consoleError('NgcWebpackPlugin is configured for integrated compilation while the compiler executed from the command line, this is not valid. Integrated compilation cancelled.');
  } ) as any;

  const project = args.p || args.project || '.';
  const cliOptions = new NgcCliOptions(args);

  const webpack = WebpackWrapper.fromConfig(args.webpack);

  return runInternal(project, cliOptions, webpack)
    .then(() => 0)
    .catch(e => {
      if (e instanceof UserError || e instanceof SyntaxError) {
        consoleError(e.message);
        return Promise.resolve(1);
      } else {
        consoleError(e.stack);
        consoleError('Compilation failed');
        return Promise.resolve(1);
      }
    });
}

// CLI entry point
if (require.main === module) {
  const args = require('minimist')(process.argv.slice(2));
  main(args).then((exitCode: number) => process.exit(exitCode));
}
