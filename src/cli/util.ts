import * as path from 'path';
import * as ts from 'typescript';

import {
  CompilerOptions,
  exitCodeFromResult,
  formatDiagnostics,
  Diagnostics,
  filterErrorsAndWarnings,
  TsEmitCallback
} from '@angular/compiler-cli';

import * as tsickle from 'tsickle';

export const GENERATED_FILES = /(.*?)\.(ngfactory|shim\.ngstyle|ngstyle|ngsummary)\.(js|d\.ts|ts)$/;
export const DTS = /\.d\.ts$/;

export interface ParsedDiagnostics {
  exitCode: number;
  error?: Error;
}

export function parseDiagnostics(allDiagnostics: Diagnostics,
                                 options?: CompilerOptions): ParsedDiagnostics {
  const result: ParsedDiagnostics = { exitCode: exitCodeFromResult(allDiagnostics) };

  const errorsAndWarnings = filterErrorsAndWarnings(allDiagnostics);
  if (errorsAndWarnings.length) {
    let currentDir = options ? options.basePath : undefined;
    const formatHost: ts.FormatDiagnosticsHost = {
      getCurrentDirectory: () => currentDir || ts.sys.getCurrentDirectory(),
      getCanonicalFileName: fileName => fileName,
      getNewLine: () => ts.sys.newLine
    };
    result.error = new Error(formatDiagnostics(errorsAndWarnings, formatHost));
  }
  return result;
}

export function createEmitCallback(options: CompilerOptions): TsEmitCallback | undefined {
  const transformDecorators = options.annotationsAs !== 'decorators';
  const transformTypesToClosure = options.annotateForClosureCompiler;
  if (!transformDecorators && !transformTypesToClosure) {
    return undefined;
  }
  if (transformDecorators) {
    // This is needed as a workaround for https://github.com/angular/tsickle/issues/635
    // Otherwise tsickle might emit references to non imported values
    // as TypeScript elided the import.
    options.emitDecoratorMetadata = true;
  }
  const tsickleHost: tsickle.TsickleHost = {
    shouldSkipTsickleProcessing: fileName => DTS.test(fileName) || GENERATED_FILES.test(fileName),
    pathToModuleName: (context, importPath) => '',
    shouldIgnoreWarningsForPath: (filePath) => false,
    fileNameToModuleId: (fileName) => fileName,
    googmodule: false,
    untyped: true,
    convertIndexImportShorthand: false, transformDecorators, transformTypesToClosure,
  };

  return ({
            program,
            targetSourceFile,
            writeFile,
            cancellationToken,
            emitOnlyDtsFiles,
            customTransformers = {},
            host,
            options
          }) =>
    tsickle.emitWithTsickle(
      program,
      tsickleHost,
      host,
      options,
      targetSourceFile,
      writeFile,
      cancellationToken,
      emitOnlyDtsFiles,
      {
        beforeTs: customTransformers.before,
        afterTs: customTransformers.after,
      }
    );
}

/**
 * Returns a function that can adjust a path from source path to out path,
 * based on an existing mapping from source to out path.
 *
 * TODO(tbosch): talk to the TypeScript team to expose their logic for calculating the `rootDir`
 * if none was specified.
 *
 * Note: This function works on normalized paths from typescript.
 *
 * @param outDir
 * @param outSrcMappings
 */
export function createSrcToOutPathMapper(outDir: string | undefined,
                                         sampleSrcFileName: string | undefined,
                                         sampleOutFileName: string | undefined,
                                         host: {
                                            dirname: typeof path.dirname,
                                           resolve: typeof path.resolve,
                                           relative: typeof path.relative
                                        } = path): (srcFileName: string, reverse?: boolean) => string {
  let srcToOutPath: (srcFileName: string) => string;
  if (outDir) {
    let path: {} = {};  // Ensure we error if we use `path` instead of `host`.
    if (sampleSrcFileName == null || sampleOutFileName == null) {
      throw new Error(`Can't calculate the rootDir without a sample srcFileName / outFileName. `);
    }
    const srcFileDir = normalizeSeparators(host.dirname(sampleSrcFileName));
    const outFileDir = normalizeSeparators(host.dirname(sampleOutFileName));
    if (srcFileDir === outFileDir) {
      return (srcFileName) => srcFileName;
    }
    // calculate the common suffix, stopping
    // at `outDir`.
    const srcDirParts = srcFileDir.split('/');
    const outDirParts = normalizeSeparators(host.relative(outDir, outFileDir)).split('/');
    let i = 0;
    while (i < Math.min(srcDirParts.length, outDirParts.length) &&
    srcDirParts[srcDirParts.length - 1 - i] === outDirParts[outDirParts.length - 1 - i])
      i++;
    const rootDir = srcDirParts.slice(0, srcDirParts.length - i).join('/');
    srcToOutPath = (srcFileName, reverse?) => reverse
      ? host.resolve(outDir, host.relative(rootDir, srcFileName))
      : host.resolve(rootDir, host.relative(outDir, srcFileName))
    ;
  } else {
    srcToOutPath = (srcFileName) => srcFileName;
  }
  return srcToOutPath;
}

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}
