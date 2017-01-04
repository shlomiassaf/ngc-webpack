#!/usr/bin/env node
require('ts-node/register');

import * as Path from 'path';
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

export function main(args: any, consoleError: (s: string) => void = console.error) {
  const project = args.p || args.project || '.';
  const cliOptions = new NgcCliOptions(args);

  const webpack = new WebpackWrapper(Path.join(process.cwd(), args.webpack || './webpack.config.js'));

  return Promise.resolve()
    .then( () => webpack.init() )
    .then( () => tscWrappedMain(project, cliOptions, codeGenFactory(webpack)) )
    .then( () => webpack.emitOnCompilationSuccess() )
    .then(() => 0)
    .catch(e => {
      webpack.emitOnCompilationError(e);
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
