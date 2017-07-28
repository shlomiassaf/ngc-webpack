import * as ts from 'typescript';
import * as tsMock from './ts-mock';

export class WalkerContext {
}

export class BaseTransformWalker<T extends WalkerContext = WalkerContext> {
  public readonly walkerContext: T;

  constructor(public sourceFile: ts.SourceFile,
              public context: ts.TransformationContext,
              walkerContext?: WalkerContext) {

    this.walkerContext = walkerContext || new WalkerContext() as any;
  }

  walk(): ts.Node {
    if (this.sourceFile.isDeclarationFile) {
      return this.sourceFile;
    } else {
      const visited = this.visitNode(this.sourceFile);
      ts.addEmitHelpers(visited, this.context.readEmitHelpers());
      return visited;

    }
  }

  protected visitClassDeclaration(node: ts.ClassDeclaration) {
    return this.walkChildren(node);
  }

  protected visitConstructorDeclaration(node: ts.ConstructorDeclaration) {
    return this.walkChildren(node);
  }

  protected visitParameterDeclaration(node: ts.ParameterDeclaration) {
    return this.walkChildren(node);
  }

  protected visitPropertyDeclaration(node: ts.PropertyDeclaration) {
    return this.walkChildren(node);
  }

  protected visitMethodDeclaration(node: ts.MethodDeclaration) {
    return this.walkChildren(node);
  }

  protected visitSyntaxList(node: ts.SyntaxList) {
    return this.walkChildren(node);
  }

  protected visitDecorator(node: ts.Decorator) {
    return this.walkChildren(node);
  }

  protected visitNode(node: ts.Node): ts.Node {
    this.onBeforeVisitNode(node);

    const visited = this._visitNode(node);


    this.onAfterVisitNode(node);

    return visited;
  }

  protected filterNodes<T extends ts.Node>(nodes: ts.NodeArray<T>, test?: (node: T) => boolean): ts.NodeArray<T> | undefined {
    return nodes
      ? ts.createNodeArray(nodes.filter( n => test(n) ))
      : undefined
    ;
  }

  protected visitNodes<T extends ts.Node>(nodes: ts.NodeArray<T>, test?: (node: T) => boolean): ts.NodeArray<T> | undefined {
    if (!nodes || nodes.length === 0) {
      return undefined;
    } else {
      const resultNodes = ts.visitNodes(nodes, (n) => this.visitNode(n), test);
      if (!resultNodes || resultNodes.length === 0) {
        return undefined;
      } else {
        return nodes;
      }
    }
  }

  protected walkChildren(node: ts.Node): ts.Node {
    return ts.visitEachChild(node, (child) => this.visitNode(child), this.context);
  }

  protected onBeforeVisitNode(node: ts.Node): void { }
  protected onAfterVisitNode(node: ts.Node): void { }

  protected findAstNodes(node: ts.Node | null,
                         kind: ts.SyntaxKind,
                         recursive = false,
                         max: number = Infinity): ts.Node[] {
    if (max == 0) {
      return [];
    }
    if (!node) {
      node = this.sourceFile;
    }

    let arr: ts.Node[] = [];
    if (node.kind === kind) {
      // If we're not recursively looking for children, stop here.
      if (!recursive) {
        return [node];
      }

      arr.push(node);
      max--;
    }

    if (max > 0) {
      for (const child of node.getChildren(this.sourceFile)) {
        this.findAstNodes(child, kind, recursive, max)
          .forEach((node: ts.Node) => {
            if (max > 0) {
              arr.push(node);
            }
            max--;
          });

        if (max <= 0) {
          break;
        }
      }
    }
    return arr;
  }

  findFirstAstNode(node: ts.Node | null, kind: ts.SyntaxKind): ts.Node | null {
    return this.findAstNodes(node, kind, false, 1)[0] || null;
  }

  private _visitNode(node: ts.Node): ts.Node {
    switch (node.kind) {

      case ts.SyntaxKind.ClassDeclaration:
        return this.visitClassDeclaration(node as ts.ClassDeclaration) as any;

      case ts.SyntaxKind.Constructor:
        return this.visitConstructorDeclaration(node as ts.ConstructorDeclaration) as any;

      case ts.SyntaxKind.Parameter:
        return this.visitParameterDeclaration(node as ts.ParameterDeclaration) as any;

      case ts.SyntaxKind.PropertyDeclaration:
        return this.visitPropertyDeclaration(node as ts.PropertyDeclaration) as any;

      case ts.SyntaxKind.MethodDeclaration:
        return this.visitMethodDeclaration(node as ts.MethodDeclaration) as any;

      case ts.SyntaxKind.SyntaxList:
        return this.visitSyntaxList(node as ts.SyntaxList) as any;

      case ts.SyntaxKind.Decorator:
        return this.visitDecorator(node as ts.Decorator) as any;

      default:
        return this.walkChildren(node);
    }
  }
}
