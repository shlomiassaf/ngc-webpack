import * as Path from 'path';
import * as ts from 'typescript';
import { loader as l } from 'webpack';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import ngcLoader from '@ngtools/webpack';
import aotCleanLoader from '../../src/aot-clean-transformer/loader';

import { aotCleanupTransformer } from '../../src/aot-clean-transformer';

export const tsConfig = {
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.ES2015,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  emitDecoratorMetadata: true,
  experimentalDecorators: true,
  noEmitOnError: true,
  noEmitHelpers: true,
  allowSyntheticDefaultImports: true,
  sourceMap: false,
  strictNullChecks: false,
  lib: [
    'lib.es2015.d.ts',
    'lib.dom.d.ts'
  ],
  types: [
    'node'
  ]
};

export function compile(filePaths: string[]): { [filename: string]: string } {
  const program = ts.createProgram(filePaths, tsConfig);

  const transformers: ts.CustomTransformers = {
    before: [ aotCleanupTransformer ],
    after: []
  };


  const result: { [filename: string]: string } = {};

  const writeFileCallback: ts.WriteFileCallback = (filename: string, data: string) => {
    result[Path.basename(filename)] = data;
  };

  const { emitSkipped, diagnostics } = program.emit(undefined, writeFileCallback, undefined, false, transformers);

  if (emitSkipped) {
    throw new Error(diagnostics.map(diagnostic => diagnostic.messageText).join('\n'));
  } else {
    return result;
  }
}



export interface NgToolsLoaderOutput {
  error: Error | undefined,
  resourcePath: string;
  source: string | null,
  sourceMap: string | null
}

const ngToolsLoaderHitEmitter = new Subject<NgToolsLoaderOutput>();

export const onNgToolsLoaderHit: Observable<NgToolsLoaderOutput> = ngToolsLoaderHitEmitter.asObservable();

export let hijackedLoader: 'ngtools' | 'self' = 'ngtools';

export function setWrappedLoader(loader: 'ngtools' | 'self'): void {
  hijackedLoader = loader;
}

export function ngToolsLoaderWrapper(this: l.LoaderContext & { _compilation: any }, source: string | null, srcMap: string | undefined) {
  const wrappedThis = Object.create(this);

  let cb: any;

  function callbackHijack(err, src, srcMap) {
    ngToolsLoaderHitEmitter.next({
      error: err,
      resourcePath: wrappedThis.resourcePath,
      source: src,
      sourceMap: srcMap,
    });
    cb(err, src, srcMap);
  }

  wrappedThis.async = () => {
    cb = this.async();
    return callbackHijack;
  };

  if (hijackedLoader === 'self') {
    Object.defineProperty(wrappedThis, 'query', { value: {
      disable: false,
      tsConfigPath: './tsconfig.aot-transformer.json'
    } });
  }

  const result = hijackedLoader === 'self'
    ? aotCleanLoader.call(wrappedThis, source, srcMap)
    : ngcLoader.call(wrappedThis, source, srcMap)
  ;


  return result;
}

export default ngToolsLoaderWrapper;
