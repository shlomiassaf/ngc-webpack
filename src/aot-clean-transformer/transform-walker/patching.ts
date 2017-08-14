import * as ts from 'typescript';

let unpatch: () => void = undefined;

export namespace patching {
  export function unpathTypeScript() {
    if (unpatch) {
      unpatch();
    }
  }

  export function patchTypeScript(): void {
    if (unpatch) {
      return;
    }

    const toMonkeyPatch = ['nodeCanBeDecorated', 'nodeIsDecorated', 'childIsDecorated', 'nodeOrChildIsDecorated'];
    const originalPatched = toMonkeyPatch.reduce( (obj, k) => { obj[k] = ts[k]; return obj; }, {} );
    const patching = {
      nodeCanBeDecorated(node: ts.Node): boolean {
        return originalPatched['nodeCanBeDecorated'](node.parent ? node : node['original']);
      },
      nodeIsDecorated(node: ts.Node): boolean {
        return node.decorators !== undefined
          && patching.nodeCanBeDecorated(node);
      },
      childIsDecorated(node: ts.Node): boolean {
        switch (node.kind) {
          case ts.SyntaxKind.ClassDeclaration:
            return ts['forEach']((<ts.ClassDeclaration>node).members, patching.nodeOrChildIsDecorated);
          case ts.SyntaxKind.MethodDeclaration:
          case ts.SyntaxKind.SetAccessor:
            return ts['forEach']((<ts.FunctionLikeDeclaration>node).parameters, patching.nodeIsDecorated);
        }
      },
      nodeOrChildIsDecorated(node: ts.Node): boolean {
        return patching.nodeIsDecorated(node) || patching.childIsDecorated(node);
      }
    };
    toMonkeyPatch.forEach( k => ts[k] = patching[k]);

    unpatch = () => toMonkeyPatch.forEach( k => ts[k] = originalPatched[k]);
  }

  export function patchTransformer(transformFactory: ts.TransformerFactory<any>) {
    return (context: ts.TransformationContext) => {
      const fn = transformFactory(context);
      return function (file: ts.SourceFile) {
        const sourceFile = fn(file);
        if (sourceFile !== file) {
          if (!sourceFile['symbol']) {
            sourceFile['symbol'] = file['symbol'];
          }
          if (!sourceFile['locals']) {
            sourceFile['locals'] = sourceFile['original']['locals'];
          }
        }
        return sourceFile;
      }
    }
  }
}