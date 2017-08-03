import * as ts from 'typescript';

export function angularImportsFromNode(node: ts.ImportDeclaration, _sourceFile: ts.SourceFile): string[] {
  const ms = node.moduleSpecifier;
  let modulePath: string | null = null;
  switch (ms.kind) {
    case ts.SyntaxKind.StringLiteral:
      modulePath = (ms as ts.StringLiteral).text;
      break;
    default:
      return [];
  }

  if (!modulePath.startsWith('@angular/')) {
    return [];
  }

  if (node.importClause) {
    if (node.importClause.name) {
      // This is of the form `import Name from 'path'`. Ignore.
      return [];
    } else if (node.importClause.namedBindings) {
      const nb = node.importClause.namedBindings;
      if (nb.kind == ts.SyntaxKind.NamespaceImport) {
        // This is of the form `import * as name from 'path'`. Return `name.`.
        return [(nb as ts.NamespaceImport).name.text + '.'];
      } else {
        // This is of the form `import {a,b,c} from 'path'`
        const namedImports = nb as ts.NamedImports;

        return namedImports.elements
          .map((is: ts.ImportSpecifier) => is.propertyName ? is.propertyName.text : is.name.text);
      }
    }
  } else {
    // This is of the form `import 'path';`. Nothing to do.
    return [];
  }
}

/**
 * Find the matching twin node for a node where both root and node have a twin SourceFile.
 * Twin SourceFiles are 2 instances of a the same source file.
 *
 * @param root
 * @param node
 * @return {any}
 */
export function findRemoteMatch<T extends ts.Node>(root: ts.Node, node: T): T | undefined {
  if (root.kind === node.kind && root.getStart() === node.getStart()) {
    return <any>root;
  } else if (node.getStart() >= root.getStart() && node.getEnd() <= root.getEnd()) {
    for (let child of root.getChildren(root.getSourceFile())) {
      const result = findRemoteMatch(child, node);
      if (result) {
        return result;
      }
    }
  }
}