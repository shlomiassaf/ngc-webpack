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

export function ctorParameName(paramNode: ts.ParameterDeclaration): string {
  let typeName = 'undefined';

  if (paramNode.type) {
    switch (paramNode.type.kind) {
      case ts.SyntaxKind.TypeReference:
        const type = paramNode.type as ts.TypeReferenceNode;
        if (type.typeName) {
          typeName = type.typeName.getText(this.sourceFile);
        } else {
          typeName = type.getText(this.sourceFile);
        }
        break;
      case ts.SyntaxKind.AnyKeyword:
        typeName = 'undefined';
        break;
      default:
        typeName = 'null';
    }
  }

  return typeName;
}