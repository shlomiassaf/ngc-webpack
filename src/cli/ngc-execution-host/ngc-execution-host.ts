import * as Path from 'path';

import { NgcWebpackPluginOptions } from '../../plugin-options';
import { NgcCompilerExecutionHost } from '../../execution-models';
import { promiseWrapper } from '../../utils';
import { NgcParsedConfiguration } from '../config';
import { CompilationResult, parseDiagnostics } from '../util';
import { performCompilationAsync } from './perform_compile_async';
import { createCliContext } from './ngc-context';

export interface AsyncNgcCompilerExecutionHost<T> extends NgcCompilerExecutionHost {
  /**
   * Execute the compilation async
   * @param compiler
   * @returns {Promise<T>}
   */
  executeAsync(compiler: any): Promise<T>;
}

/**
 * An async execution host factory implementation of [[ngcExecutionHostFactory]]
 *
 * Execution hosts are executed within the `NgcWebpackPlugin` and the plugin implements the webpack plugin API.
 * This works great for bundling since webpack manages the whole process and notifies when done.
 * In `ngc` execution webpack is only a resource compiler and does not manage the process so we need to get notified
 * when the the execution is done which is not possible through the plugin.
 *
 * To solve this issue this function wraps the execution method and return the result + a promise that emits when
 * execution is done.
 *
 * The actual async logic is done in [[ngcExecutionHostFactory]] but in the `executeAsync` method which is not fired
 * by the plugin. T
 */
export function asyncNgcExecutionHostFactory(config: NgcParsedConfiguration): {
  executionHostFactory: (options: NgcWebpackPluginOptions) => NgcCompilerExecutionHost,
  executeDone: Promise<CompilationResult>
} {
  const executionHostFactory = ngcExecutionHostFactory(config);
  const p = promiseWrapper<CompilationResult>();

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

/**
 * An execution host factory for the `@angular/compiler-cli` (ngc) compiler creating AOT compilations.
 * This execution host will perform a TS -> JS compilation per module without any bundling which makes it suitable
 * for library compilation.
 *
 * > The host factory creates and configures the execution host, actual logic for the execution host is managed by
 * the context (ngc-context.ts)
 */
export function ngcExecutionHostFactory(config: NgcParsedConfiguration): (options: NgcWebpackPluginOptions) => AsyncNgcCompilerExecutionHost<CompilationResult> {
  return (options: NgcWebpackPluginOptions): AsyncNgcCompilerExecutionHost<CompilationResult> => {
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
        executeAsync(compiler: any): Promise<CompilationResult> {
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

              if (compilation.errors.length === 0) {
                // inline resources into the flat metadata json file, if exists.
                if (config.options.flatModuleOutFile) {
                  // TODO: check that it exists, config.rootNames should not have it (i.e. it was added to rootNames)
                  const flatModulePath = rootNames[rootNames.length - 1];
                  ctx.inlineFlatModuleMetadataBundle(Path.dirname(flatModulePath), config.options.flatModuleOutFile);
                }

                parsedDiagnostics.result = {
                  sourceToOutMapper: ctx.getSourceToOutMapper(),
                  emitResult: result.emitResult
                };
              }

              return parsedDiagnostics;
            } );
      },
      compilerHost,
      transformers: []
    }
  }
}
