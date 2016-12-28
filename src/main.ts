#!/usr/bin/env node
import * as Path from 'path';
import 'reflect-metadata';
import { main as tscWrappedMain, NgcCliOptions, UserError } from '@angular/tsc-wrapped';
import { SyntaxError } from '@angular/compiler' ;
import { CodeGenerator, CompilerHostContext } from '@angular/compiler-cli' ;

import { WebpackChainModuleResolutionHostAdapter } from './webpack-chain-module-resolution-host-adapter';

function codeGenFactory(args: any, consoleError: (s: string) => void) {
  const webpackConfigPath = Path.join(process.cwd(), args.webpack || './webpack.config.js');
  let config: any;

  try {
    config = require(webpackConfigPath);
  } catch (err) {
    consoleError(`Invalid webpack configuration. Please set a valid --webpack argument.\n${err.message}`);
    throw err;
  }

  return (ngOptions, cliOptions, program, host) => {
    const hostContext: CompilerHostContext = new WebpackChainModuleResolutionHostAdapter(host, config);
    return CodeGenerator.create(ngOptions, cliOptions, program, host, hostContext).codegen();
  }
}

export function main(args: any, consoleError: (s: string) => void = console.error) {
  const project = args.p || args.project || '.';
  const cliOptions = new NgcCliOptions(args);

  return tscWrappedMain(project, cliOptions, codeGenFactory(args, consoleError))
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
