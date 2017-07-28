import * as ts from 'typescript';
import * as semver from 'semver';

// Patching TS 2.4.2 and lower due to a bug.
// https://github.com/Microsoft/TypeScript/issues/17384
// https://github.com/Microsoft/TypeScript/pull/17387

// TODO: When removing this code also remove semver and @types/semver

const _nodeCanBeDecorated = ts['nodeCanBeDecorated'];
function nodeCanBeDecorated(node: ts.Node): boolean {
  return _nodeCanBeDecorated(node.parent ? node : node['original']);
}

function nodeIsDecorated(node: ts.Node): boolean {
  return node.decorators !== undefined
    && nodeCanBeDecorated(node);
}

function childIsDecorated(node: ts.Node): boolean {
  switch (node.kind) {
    case ts.SyntaxKind.ClassDeclaration:
      return ts['forEach']((<ts.ClassDeclaration>node).members, nodeOrChildIsDecorated);
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.SetAccessor:
      return ts['forEach']((<ts.FunctionLikeDeclaration>node).parameters, nodeIsDecorated);
  }
}

function nodeOrChildIsDecorated(node: ts.Node): boolean {
  return nodeIsDecorated(node) || childIsDecorated(node);
}

if (semver.lte(ts.version, '2.4.2')) {
  ts['nodeCanBeDecorated'] = nodeCanBeDecorated;
  ts['nodeIsDecorated'] = nodeIsDecorated;
  ts['childIsDecorated'] = childIsDecorated;
  ts['nodeOrChildIsDecorated'] = nodeOrChildIsDecorated;
}

