// @ignoreDep typescript
import * as Path from 'path';
import * as ts from 'typescript';

import { collectDeepNodes } from './fw/ast_helpers';
import { makeTransform } from './fw/make_transform';
import {
  StandardTransform,
  ReplaceNodeOperation
} from './fw/interfaces';

export function inlineResources(getResource: (resourcePath: string) => string | undefined,
                                shouldTransform: (fileName: string) => boolean): ts.TransformerFactory<ts.SourceFile> {
  const createInlineLiteral = createInlineLiteralFactory(getResource);
  const standardTransform: StandardTransform = function (sourceFile: ts.SourceFile) {
    if (!shouldTransform(sourceFile.fileName)) {
      return [];
    }
    return findResources(sourceFile, createInlineLiteral);
  };

  return makeTransform(standardTransform);
}

export function findResources(sourceFile: ts.SourceFile,
                              createInlineLiteral: (resourcePath: string) => ts.LiteralExpression  | undefined): ReplaceNodeOperation[] {
  const replacements: ReplaceNodeOperation[] = [];

  // Find all object literals.
  collectDeepNodes<ts.ObjectLiteralExpression>(sourceFile, ts.SyntaxKind.ObjectLiteralExpression)
  // Get all their property assignments.
    .map(node => collectDeepNodes<ts.PropertyAssignment>(node, ts.SyntaxKind.PropertyAssignment))
    // Flatten into a single array (from an array of array<property assignments>).
    .reduce((prev, curr) => curr ? prev.concat(curr) : prev, [])
    // We only want property assignments for the templateUrl/styleUrls keys.
    .filter((node: ts.PropertyAssignment) => {
      const key = _getContentOfKeyLiteral(node.name);
      if (!key) {
        // key is an expression, can't do anything.
        return false;
      }
      return key == 'templateUrl' || key == 'styleUrls';
    })
    // Replace templateUrl/styleUrls key with template/styles, and and paths with require('path').
    .forEach((node: ts.PropertyAssignment) => {
      const key = _getContentOfKeyLiteral(node.name);

      if (key == 'templateUrl') {
        const resourcePath = _getResourceRequest(node.initializer, sourceFile);
        const inlineLiteral = createInlineLiteral(resourcePath.resolved);

        if (!inlineLiteral) {
          const fileName = Path.relative(process.cwd(), sourceFile.fileName);
          throw new Error(`Could not find templateUrl expression "${resourcePath.raw}" in "${fileName}"`);
        }

        const propAssign = ts.createPropertyAssignment('template', inlineLiteral);

        replacements.push(new ReplaceNodeOperation(sourceFile, node, propAssign));
      } else if (key == 'styleUrls') {
        const arr = collectDeepNodes<ts.ArrayLiteralExpression>(node, ts.SyntaxKind.ArrayLiteralExpression);

        if (!arr || arr.length == 0 || arr[0].elements.length == 0) {
          return;
        }

        const styleLiterals: ts.Expression[] = [];
        arr[0].elements.forEach((element: ts.Expression) => {
          const resourcePath = _getResourceRequest(element, sourceFile);
          const inlineLiteral = createInlineLiteral(resourcePath.resolved);

          if (!inlineLiteral) {
            const fileName = Path.relative(process.cwd(), sourceFile.fileName);
            throw new Error(`Could not find styleUrl expression "${resourcePath.raw}" in "${fileName}"`);
          }

          styleLiterals.push(inlineLiteral);
        });

        const propAssign = ts.createPropertyAssignment('styles', ts.createArrayLiteral(styleLiterals));
        replacements.push(new ReplaceNodeOperation(sourceFile, node, propAssign));
      }
    });

  return replacements;

}

function _getContentOfKeyLiteral(node?: ts.Node): string | null {
  if (!node) {
    return null;
  } else if (node.kind == ts.SyntaxKind.Identifier) {
    return (node as ts.Identifier).text;
  } else if (node.kind == ts.SyntaxKind.StringLiteral) {
    return (node as ts.StringLiteral).text;
  } else {
    return null;
  }
}

function _getResourceRequest(element: ts.Expression, sourceFile: ts.SourceFile): { raw: string, resolved: string } {
  if (element.kind == ts.SyntaxKind.StringLiteral) {
    let url = (element as ts.StringLiteral).text;
    // If the URL does not start with / OR ./ OR ../, prepends ./ to it.
    if (! (/(^\.?\.\/)|(^\/)/.test(url)) ) {
      url = './' + url;
    }
    return {
      raw: (element as ts.StringLiteral).text,
      resolved: resolveResourcePath(url, sourceFile)
    };
  } else {
    throw new Error('Expressions are not supported when inlining resources.')
  }
}

function resolveResourcePath(fileName: string, sourceFile: ts.SourceFile): string {
  if (fileName[0] === '/') {
    return fileName;
  } else {
    const dir = Path.dirname(sourceFile.fileName);
    return Path.resolve(dir, fileName);
  }
}

function createInlineLiteralFactory(getResource: (resourcePath: string) => string | undefined) {
  return (resourcePath: string): ts.LiteralExpression | undefined => {
    const inlineContent = getResource(resourcePath);
    return inlineContent ? ts.createLiteral(inlineContent) : undefined;
  }
}
