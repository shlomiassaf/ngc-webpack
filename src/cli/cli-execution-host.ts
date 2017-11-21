import * as Path from 'path';

import { NgcWebpackPluginOptions } from '../plugin-options';
import { NgcCompilerExecutionHost } from '../execution-models';

import { NgcParsedConfiguration } from './config';
import {ParsedDiagnostics, parseDiagnostics} from './util';
import { performCompilationAsync } from './perform_compile_async';
import { createCliContext } from './cli-context';
import { promiseWrapper } from '../utils';

export interface AsyncNgcCompilerExecutionHost<T> extends NgcCompilerExecutionHost {
  executeAsync(compiler: any): Promise<T>;
}

export function asyncCliExecutionHostFactory(config: NgcParsedConfiguration): {
  executionHostFactory: (options: NgcWebpackPluginOptions) => NgcCompilerExecutionHost,
  executeDone: Promise<ParsedDiagnostics>
} {
  const executionHostFactory = cliExecutionHostFactory(config);
  const p = promiseWrapper<ParsedDiagnostics>();

  const wrapper = (options: NgcWebpackPluginOptions): NgcCompilerExecutionHost => {
    const result = executionHostFactory(options);
    return Object.create(result, {
      execute: {
        value: (compiler: any) => result.executeAsync(compiler).then(p.resolve) .catch(p.reject)
      }
    });
  };

  return {
    executionHostFactory: wrapper,
    executeDone: p.promise
  }
}

export function cliExecutionHostFactory(config: NgcParsedConfiguration): (options: NgcWebpackPluginOptions) => AsyncNgcCompilerExecutionHost<ParsedDiagnostics> {
  return (options: NgcWebpackPluginOptions): AsyncNgcCompilerExecutionHost<ParsedDiagnostics> => {
    const inline = config.options.skipTemplateCodegen;
    if (config.options.skipTemplateCodegen && !config.options.fullTemplateTypeCheck) {
      /*
        Angular cli's compiler host will not generate metadata if skipping template codegen or no full template typescheck.
        See https://github.com/angular/angular/blob/master/packages/compiler-cli/src/transformers/compiler_host.ts#L440
        This is required if we want to inline the resources while compiling and not in post.

        To solve this we need to enforce `fullTemplateTypeCheck`:

        options.fullTemplateTypeCheck = true;

        but this has issues
        see issue: https://github.com/angular/angular/issues/19905
        which has pending PR to fix: https://github.com/angular/angular/pull/20490
        and also, dev's might want this off...

        current workaround will is to disable skipTemplateCodegen
        this looks weired because we want it on...
        but, at this point we have a config object (NgcParsedConfiguration) which is an angular-cli parsed config
        created by called `readNgcCommandLineAndConfiguration`.
        The config object has a property `emitFlags` which at this point has the flag `Codegen` OFF !!!
        OFF reflects config.options.skipTemplateCodegen = true.

        Setting `config.options.skipTemplateCodegen` to false, at this point, will not change the emitFlags.
        The compiler will NOT emit template code gen but the `isSourceFile` method in
        https://github.com/angular/angular/blob/master/packages/compiler-cli/src/transformers/compiler_host.ts#L440
        will return true!

        This is a weak workaround and a more solid one is required.

        TODO: refactor workaround to a writeFile wrapper that will not write generated files.
       */
      // options.fullTemplateTypeCheck = true;
      config.options.skipTemplateCodegen = false;
    }

    const ctx = createCliContext(config);
    const { compilerHost } = ctx;

    return {
        execute(compiler: any): void {
          this.executeAsync(compiler);
        },
        executeAsync(compiler: any): Promise<ParsedDiagnostics> {
          const compilation = ctx.createCompilation(compiler);
          const rootNames = config.rootNames.slice();

          return performCompilationAsync({
            rootNames,
            options: config.options,

            /*
                The compiler host "writeFile" is wrapped with a handler that will
                inline all resources into metadata modules (non flat bundle modules)
             */
            host: (inline && !config.options.skipMetadataEmit && !config.options.flatModuleOutFile)
              ? ctx.resourceInliningCompilerHost()
              : compilerHost
            ,
            emitFlags: config.emitFlags,
            // we use the compiler-cli emit callback but we wrap it so we can create a map of source file path to
            // output file path
            emitCallback: ctx.emitCallback,
            customTransformers: {
              beforeTs: inline ? [ ctx.createInlineResourcesTransformer() ] : []
            }
          })
            .then( result => {
              const parsedDiagnostics = parseDiagnostics(result.diagnostics, config.options);
              if (parsedDiagnostics.exitCode !== 0) {
                const error = parsedDiagnostics.error || new Error(parsedDiagnostics.exitCode.toString());
                compilation.errors.push(error);
              }

              // inline resources into the flat metadata json file, if exists.
              if (compilation.errors.length === 0 && config.options.flatModuleOutFile) {
                // TODO: check that it exists, config.rootNames should not have it (i.e. it was added to rootNames)
                const flatModulePath = rootNames[rootNames.length - 1];
                ctx.inlineFlatModuleMetadataBundle(Path.dirname(flatModulePath), config.options.flatModuleOutFile);
              }

              return parsedDiagnostics;
            } );
      },
      compilerHost,
      transformers: []
    }
  }
}
