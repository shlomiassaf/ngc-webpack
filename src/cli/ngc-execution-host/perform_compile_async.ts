/*  Copied from https://github.com/angular/angular/blob/master/packages/compiler-cli/src/perform_compile.ts
    but witch async support for program.loadNgStructureAsync()
 */

import * as ts from 'typescript';
import {isSyntaxError} from '@angular/compiler';
import {
  Program,
  CompilerHost,
  CompilerOptions,
  TsEmitCallback,
  CustomTransformers,
  PerformCompilationResult,
  createCompilerHost,
  createProgram,
  Diagnostic,
  Diagnostics,
  EmitFlags,
  DEFAULT_ERROR_CODE,
  UNKNOWN_ERROR_CODE,
  SOURCE
} from '@angular/compiler-cli';

export function performCompilationAsync({
                                          rootNames, options, host, oldProgram, emitCallback,
                                          gatherDiagnostics = asyncDiagnostics,
                                          customTransformers, emitFlags = EmitFlags.Default
                                        }: {
  rootNames: string[],
  options: CompilerOptions,
  host?: CompilerHost,
  oldProgram?: Program,
  emitCallback?: TsEmitCallback,
  gatherDiagnostics?: (program: Program) => Diagnostics,
  customTransformers?: CustomTransformers,
  emitFlags?: EmitFlags
}): Promise<PerformCompilationResult> {
  let program: Program | undefined;
  let emitResult: ts.EmitResult | undefined;
  let allDiagnostics: Diagnostics = [];

  return Promise.resolve()
    .then(() => {
      if (!host) {
        host = createCompilerHost({options});
      }
      program = createProgram({rootNames, host, options, oldProgram});
      return program.loadNgStructureAsync()
    })
    .then(() => {
      const beforeDiags = Date.now();
      allDiagnostics.push(...gatherDiagnostics(program !));
      if (options.diagnostics) {
        const afterDiags = Date.now();
        allDiagnostics.push(
          createMessageDiagnostic(`Time for diagnostics: ${afterDiags - beforeDiags}ms.`));
      }

      if (!hasErrors(allDiagnostics)) {
        emitResult = program !.emit({emitCallback, customTransformers, emitFlags});
        allDiagnostics.push(...emitResult.diagnostics);
        return {diagnostics: allDiagnostics, program, emitResult};
      }
      return {diagnostics: allDiagnostics, program};
    })
    .catch(e => {
      let errMsg: string;
      let code: number;
      if (isSyntaxError(e)) {
        // don't report the stack for syntax errors as they are well known errors.
        errMsg = e.message;
        code = DEFAULT_ERROR_CODE;
      } else {
        errMsg = e.stack;
        // It is not a syntax error we might have a program with unknown state, discard it.
        program = undefined;
        code = UNKNOWN_ERROR_CODE;
      }
      allDiagnostics.push(
        {category: ts.DiagnosticCategory.Error, messageText: errMsg, code, source: SOURCE});
      return {diagnostics: allDiagnostics, program};
    })
}


function asyncDiagnostics(angularProgram: Program): Diagnostics {
  const allDiagnostics: Diagnostics = [];

  // Check Angular structural diagnostics.
  allDiagnostics.push(...angularProgram.getNgStructuralDiagnostics());

  // Check TypeScript parameter diagnostics.
  allDiagnostics.push(...angularProgram.getTsOptionDiagnostics());

  // Check Angular parameter diagnostics.
  allDiagnostics.push(...angularProgram.getNgOptionDiagnostics());


  function checkDiagnostics(diags: Diagnostics | undefined) {
    if (diags) {
      allDiagnostics.push(...diags);
      return !hasErrors(diags);
    }
    return true;
  }

  let checkOtherDiagnostics = true;
  // Check TypeScript syntactic diagnostics.
  checkOtherDiagnostics = checkOtherDiagnostics &&
    checkDiagnostics(angularProgram.getTsSyntacticDiagnostics(undefined));

  // Check TypeScript semantic and Angular structure diagnostics.
  checkOtherDiagnostics = checkOtherDiagnostics &&
    checkDiagnostics(angularProgram.getTsSemanticDiagnostics(undefined));

  // Check Angular semantic diagnostics
  checkOtherDiagnostics = checkOtherDiagnostics &&
    checkDiagnostics(angularProgram.getNgSemanticDiagnostics(undefined));

  return allDiagnostics;
}

function defaultGatherDiagnostics(program: Program): Diagnostics {
  const allDiagnostics: Diagnostics = [];

  function checkDiagnostics(diags: Diagnostics | undefined) {
    if (diags) {
      allDiagnostics.push(...diags);
      return !hasErrors(diags);
    }
    return true;
  }

  let checkOtherDiagnostics = true;
  // Check parameter diagnostics
  checkOtherDiagnostics = checkOtherDiagnostics &&
    checkDiagnostics([...program.getTsOptionDiagnostics(), ...program.getNgOptionDiagnostics()]);

  // Check syntactic diagnostics
  checkOtherDiagnostics =
    checkOtherDiagnostics && checkDiagnostics(program.getTsSyntacticDiagnostics());

  // Check TypeScript semantic and Angular structure diagnostics
  checkOtherDiagnostics =
    checkOtherDiagnostics &&
    checkDiagnostics(
      [...program.getTsSemanticDiagnostics(), ...program.getNgStructuralDiagnostics()]);

  // Check Angular semantic diagnostics
  checkOtherDiagnostics =
    checkOtherDiagnostics && checkDiagnostics(program.getNgSemanticDiagnostics());

  return allDiagnostics;
}

function hasErrors(diags: Diagnostics) {
  return diags.some(d => d.category === ts.DiagnosticCategory.Error);
}

function createMessageDiagnostic(messageText: string): ts.Diagnostic & Diagnostic {
  return {
    file: undefined,
    start: undefined,
    length: undefined,
    category: ts.DiagnosticCategory.Message, messageText,
    code: DEFAULT_ERROR_CODE,
    source: SOURCE,
  };
}
