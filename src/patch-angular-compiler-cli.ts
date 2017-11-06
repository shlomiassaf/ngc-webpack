/**
 * This module will patch the `@angular/compiler-cli` so it will correctly lower expression to declarations in decorators.
 * See https://github.com/angular/angular/issues/20216
 */
import * as ts from 'typescript';
import '@angular/compiler-cli';
const lowerExpressions = require('@angular/compiler-cli/src/transformers/lower_expressions');

function touchNode(node: ts.Node) {
  if (!node.parent) {
    const original: ts.Node = <any> ts.getOriginalNode(node);
    if (original !== node && original.parent) {
      node.parent = original.parent;
      ts.forEachChild(node, touchNode)
    }
  }
}

const getExpressionLoweringTransformFactory = lowerExpressions.getExpressionLoweringTransformFactory;
lowerExpressions.getExpressionLoweringTransformFactory = function(requestsMap, program) {
  const fn = getExpressionLoweringTransformFactory(requestsMap, program);
  return context => sourceFile => {
    const result = fn(context)(sourceFile);
    if (result !== sourceFile) {
      ts.forEachChild(result, touchNode)
    }
    return result;
  };
};
