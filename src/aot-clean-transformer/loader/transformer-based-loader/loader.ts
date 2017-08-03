import * as Path from 'path';
import * as ts from 'typescript';
import { loader as l } from 'webpack';
const loaderUtils = require('loader-utils');

import { aotCleanupTransformer } from '../../index';
import { findPlugin } from '../../../webpack-wrapper';

let AOTMode: boolean;
let compilerOptions: ts.CompilerOptions;

export interface AotCleanupLoaderOptions {
  /**
   * If false the plugin is a ghost, it will not perform any action.
   * This property can be used to trigger AOT on/off depending on your build target (prod, staging etc...)
   *
   * The state can not change after initializing the plugin.
   * @default true
   */
  disable?: false;

  /**
   * A path to a TSConfig file, optional if a plugin is supplied.
   * When both are available `tsConfigPath` wins.
   */
  tsConfigPath?: any;

  /**
   * Optional TS compiler options.
   *
   * > Some options set by the loader can not change.
   */
  compilerOptions?: any;
}

function init(this: l.LoaderContext & { _compilation: any }): void {
  const plugin = findPlugin(this._compilation);
  const options: AotCleanupLoaderOptions = loaderUtils.getOptions(this) || {};

  if (options.disable === false) {
    AOTMode = true;
  } else {
    AOTMode = false;
  }

  let tsConfigPath: string = options.tsConfigPath;

  if (!tsConfigPath && plugin) {
    tsConfigPath = plugin.options.tsConfig;
  }

  if (tsConfigPath === undefined) {
    throw new Error('aot-transformer is being used as a loader but no `tsConfigPath` option nor '
      + 'NgcWebpackPlugin was detected. You must provide at least one of these.'
    );
  }

  const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (tsConfig.error) {
    throw tsConfig.error;
  }

  for (const key of Object.keys(options)) {
    if (key == 'tsConfigPath') {
      continue;
    }
    tsConfig.config.compilerOptions[key] = options[key];
  }

  tsConfig.config.compilerOptions.strictNullChecks = false;
  tsConfig.config.compilerOptions.declaration = false;
  tsConfig.config.compilerOptions.diagnostics = false;
  tsConfig.config.compilerOptions.noEmit = true;
  tsConfig.config.compilerOptions.skipLibCheck = true;

  const parsedConfig = ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, Path.dirname(tsConfigPath));
  compilerOptions = parsedConfig.options;
}

export function aotCleanLoader(this: l.LoaderContext & { _compilation: any }, source: string | null, sourceMap: string | null) {
  const cb = this.async();
  const sourceFileName: string = this.resourcePath;

  if (AOTMode === false || sourceFileName.endsWith('ngfactory.ts')) {
    return cb(null, source, sourceMap);
  } else if (AOTMode !== true) {
    init.call(this);
    if (AOTMode === false) {
      return cb(null, source, sourceMap);
    }
  }

  const sourceFile = ts.createSourceFile(sourceFileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const transformResults: ts.TransformationResult<ts.SourceFile> = ts.transform(sourceFile, [aotCleanupTransformer], compilerOptions);

  if (transformResults.diagnostics && transformResults.diagnostics.length >= 1) {
    const errors = diagnosticsToErrors(transformResults.diagnostics);
    if (errors.length === 1) {
      cb(errors[0]);
    } else {
      for (let e of errors) {
        this.emitError(e.message);
        cb(new Error('NgcWebpack AotCleanupLoader: Multiple Errors'));
      }
    }
  } else {
    try {
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
      const result = printer.printFile(transformResults.transformed[0]);
      cb(null, result);
    } catch (err) {
      cb(err);
    }
  }
}

function diagnosticsToErrors(diagnostics: ts.Diagnostic[]): Error[] {
  const errors: Error[] = [];
  diagnostics.forEach( d => {
    const msg = d.messageText;
    if (typeof msg === 'string') {
      errors.push(new Error(msg));
    } else {
      let chain: ts.DiagnosticMessageChain = <any>d;
      while (chain) {
        if (chain.category = ts.DiagnosticCategory.Error) {
          errors.push(new Error(chain.messageText));
        }
        chain = chain.next;
      }
    }
  });
  return errors;
}