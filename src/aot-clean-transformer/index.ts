import * as ts from 'typescript';
import { AotTransformWalker } from './transform-walker';

export function aotCleanupTransformer(context: ts.TransformationContext) {
  return function (file: ts.SourceFile) {
    const walker = new AotTransformWalker(file, context);
    return walker.walk() as any;
  }
}

