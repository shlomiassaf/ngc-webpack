import * as ts from 'typescript';
import './monket-patch-ts';
import * as utils from '../utils';
import { BaseTransformWalker, WalkerContext } from './base-transform-walker';
import { isUndefined } from "util";

export class AotWalkerContext extends WalkerContext {
  currentClass?: ts.ClassDeclaration;
  currentClassParam?: ts.ParameterDeclaration;
  currentClassProp?: ts.PropertyDeclaration;
  currentClassMethod?: ts.MethodDeclaration;
}

export class AotTransformWalker extends BaseTransformWalker<AotWalkerContext> {

  public angularImports: string[];

  constructor(public sourceFile: ts.SourceFile,
              public context: ts.TransformationContext,
              walkerContext?: WalkerContext) {

    super(sourceFile, context, walkerContext || new AotWalkerContext());


    this.angularImports = this.findAstNodes(<any>sourceFile, ts.SyntaxKind.ImportDeclaration)
      .map((node: ts.ImportDeclaration) => utils.angularImportsFromNode(node, this.sourceFile))
      .reduce((acc: string[], current: string[]) => acc.concat(current), []);

  }

  walk(): ts.Node {
    if (this.sourceFile.fileName.endsWith('ngfactory.ts')) {
      return this.sourceFile;
    } else {
      const sourceFile: ts.SourceFile = <any>super.walk();
      if (sourceFile !== this.sourceFile) {
        sourceFile['symbol'] = this.sourceFile['symbol'];
      }
      return sourceFile;
    }
  }

  protected onBeforeVisitNode(node: ts.Node): void {
    switch (node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        this.walkerContext.currentClass = <any>node;
        break;
      case ts.SyntaxKind.Parameter:
        if (this.walkerContext.currentClass && node.decorators) {
          this.walkerContext.currentClassParam = <any>node;
        }
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        if (this.walkerContext.currentClass && node.decorators) {
          this.walkerContext.currentClassProp = <any>node;
        }
        break;
      case ts.SyntaxKind.MethodDeclaration:
        if (this.walkerContext.currentClass && node.decorators) {
          this.walkerContext.currentClassMethod = <any>node;
        }
        break;

    }

  }

  protected onAfterVisitNode(node: ts.Node): void {
    switch (node.kind) {
      case ts.SyntaxKind.ClassDeclaration:
        this.walkerContext.currentClass = undefined;
        break;
      case ts.SyntaxKind.Parameter:
        this.walkerContext.currentClassParam = undefined;
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        this.walkerContext.currentClassProp = undefined;
        break;
      case ts.SyntaxKind.MethodDeclaration:
        this.walkerContext.currentClassMethod = undefined;
        break;
    }

  }

  protected visitClassDeclaration(node: ts.ClassDeclaration) {
    const members: any = node.members || [];

    const ctorParams = this.classCtorParamsToLiteralExpressions(node);
    if (ctorParams && ctorParams.length > 0) {
      const m = ts.createMethod(
        undefined,
        [ ts.createToken(ts.SyntaxKind.StaticKeyword) ],
        undefined,
        ts.createIdentifier('ctorParameters'),
        undefined,
        undefined,
        undefined,
        undefined,
        ts.createBlock( [ts.createReturn(ts.createArrayLiteral(ctorParams))] )
      );
      members.push(m);
    }

    const decorators = this.filterNodes(node.decorators, n => !this.isAngularDecorator(n));
    let newDec = <any>ts.updateClassDeclaration(
      node,
      decorators.length > 0 ? node.decorators : undefined,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      members && members.length > 0 ? members : undefined
    );

    return super.visitClassDeclaration(newDec);
  }

  protected visitParameterDeclaration(node: ts.ParameterDeclaration) {
    if (this.walkerContext.currentClassParam === node) {
      const decorators = this.filterNodes(node.decorators, n => !this.isAngularDecorator(n));
      if (decorators.length === 0) {
        let newParamDec = ts.updateParameter(
          node,
          undefined,
          node.modifiers,
          node.dotDotDotToken,
          node.name,
          node.questionToken,
          node.type,
          node.initializer
        );
        return <any>super.visitParameterDeclaration(newParamDec);
      }
    }
    return <any>super.visitParameterDeclaration(node);
  }

  protected visitPropertyDeclaration(node: ts.PropertyDeclaration) {
    if (this.walkerContext.currentClassProp) {
      const decorators = this.filterNodes(node.decorators, n => !this.isAngularDecorator(n) );
      if (decorators.length === 0) {
        const newPropDecl = ts.updateProperty(
          node,
          undefined,
          node.modifiers,
          node.name,
          node.type,
          node.initializer
        );
        return super.visitPropertyDeclaration(newPropDecl);
      }
    }
    return super.visitPropertyDeclaration(node);
  }

  protected visitMethodDeclaration(node: ts.MethodDeclaration) {
    if (this.walkerContext.currentClassMethod) {
      const decorators = this.filterNodes(node.decorators, n => !this.isAngularDecorator(n));
      if (decorators.length === 0) {
        const newMethodDecl = ts.updateMethod(
          node,
          undefined,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.questionToken,
          node.typeParameters,
          node.parameters,
          node.type,
          node.body
        );
        return super.visitMethodDeclaration(newMethodDecl);
      }
    }
    return super.visitMethodDeclaration(node);
  }

  protected visitDecorator(node: ts.Decorator) {
    if (this.walkerContext.currentClass) {
      return this.isAngularDecorator(node)
        ? undefined
        : node
        ;
    }

    return node;
  }

  private isAngularDecorator(node: ts.Node): boolean {
    return this.findAstNodes(node, ts.SyntaxKind.CallExpression)
        .filter((node: ts.CallExpression) => {
          const fnName = node.expression.getText(this.sourceFile);
          if (fnName.indexOf('.') != -1) {
            // Since this is `a.b`, see if it's the same namespace as a namespace import.
            return this.angularImports.indexOf(fnName.replace(/\..*$/, '') + '.') != -1;
          } else {
            return this.angularImports.indexOf(fnName) != -1;
          }
        }).length > 0;
  }

  private classCtorParamsToLiteralExpressions(classNode: ts.ClassDeclaration): ts.ObjectLiteralExpression[]  {
    // For every classes with constructors, output the ctorParameters function which contains a list
    // of injectable types.
    const ctor = (this.findFirstAstNode(classNode, ts.SyntaxKind.Constructor) as ts.ConstructorDeclaration);
    if (!ctor) {
      // A class can be missing a constructor, and that's _okay_.
      return [];
    }

    return Array.from(ctor.parameters)
      .map( paramNode => this.ctorParameterFromTypeReference(paramNode) );
  }


  private ctorParameterFromTypeReference(paramNode: ts.ParameterDeclaration): ts.ObjectLiteralExpression {
    const typeName = utils.ctorParameName(paramNode);

    const decorators = this.findAstNodes(paramNode, ts.SyntaxKind.Decorator) as ts.Decorator[];
    const objLiteralDecorators = this.decoratorsAsObjectLiteral(decorators);

    // TODO: A bug in ngTools shows empty decorators array literal if there are decorators
    // but they are not angular's decorators, i.e. custom or other 3rd party lib decorators.
    // when fixed, uncomment this and remove the if after it.
    // if (objLiteralDecorators.length > 0) {
    if (decorators.length > 0) {
      return ts.createObjectLiteral([
        ts.createPropertyAssignment('type', ts.createIdentifier(typeName)),
        ts.createPropertyAssignment('decorators', ts.createArrayLiteral(objLiteralDecorators))
      ]);
    } else {
      return ts.createObjectLiteral([
        ts.createPropertyAssignment('type', ts.createIdentifier(typeName))
      ]);
    }
  }

  private decoratorsAsObjectLiteral(decorators: ts.Decorator[]): ts.ObjectLiteralExpression[] {
    return decorators
      .map(decorator => {
        const call =
          this.findFirstAstNode(decorator, ts.SyntaxKind.CallExpression) as ts.CallExpression;

        if (!call) {
          return null;
        }

        const fnName = call.expression.getText(this.sourceFile);
        if (this.angularImports.indexOf(fnName) === -1) {
          return null;
        } else {
          return [
            fnName,
            call.arguments.map(x => ts.createIdentifier( x.getText(this.sourceFile) ) )
          ];
        }
      })
      .filter(x => !!x)
      .map(([name, args]: [string, ts.Identifier[]]) => {
        const propAssignments = [ ts.createPropertyAssignment('type', ts.createIdentifier(name)) ];

        if (args && args.length > 0) {
          propAssignments.push(ts.createPropertyAssignment('args', ts.createArrayLiteral(args)));
        }

        return ts.createObjectLiteral(propAssignments);
      });

  }
}
