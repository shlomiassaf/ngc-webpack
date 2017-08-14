import * as ts from 'typescript';

import * as utils from '../utils';
import { BaseTransformWalker, WalkerContext } from './base-transform-walker';
import { MockTypeChecker } from './mock-type-checker';

export class AotWalkerContext extends WalkerContext {
  scope: ts.SyntaxKind[] = [];

  addScope(node: ts.Node): void {
    this.scope.push(node.kind);
  }

  currentClass?: ts.ClassDeclaration;
  currentClassParam?: ts.ParameterDeclaration;
  currentClassProp?: ts.PropertyDeclaration;
  currentClassMethod?: ts.MethodDeclaration;
}

let mockTypeChecker: MockTypeChecker;

export class AotTransformWalker extends BaseTransformWalker<AotWalkerContext> {

  public angularImports: string[];

  private get mocker(): MockTypeChecker {
    return mockTypeChecker || (mockTypeChecker = new MockTypeChecker(this.context.getCompilerOptions()));
  }


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
      return <any>super.walk();
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
    if (node.decorators && node.decorators.some( n => this.isAngularDecorator(n)) ) {
      const members: any = node.members || [];
      const ctorParams = this.classCtorParamsToLiteralExpressions(node);

      if (ctorParams && ctorParams.length > 0) {
        // Since we are to remove the decorators we need to preserve constructor parameter types and
        // param decorators for angular to be able to use them at runtime.
        //
        // This is done by setting a static method on the class called `ctorParameters`
        // The method returns an array of type information for each ctor param.
        // The type information includes the type value and an array of decorator information.
        // Decorator information holds the decorator function and arguments (metadata) used as params
        // for the decorator factory. Decorator information exists only if the param has decorators.
        // { type: TYPE_VALUE, decorators: [ { type: DECORATOR_VALUE: args: [...] }
        //
        // If the class extends a base class astatic method might fail type check when the signature
        // of constructors does not match.
        // Type script will complain if extending class static's ctorParameters method does not match parent
        // If the class extends another class we do not set the `ctorParameters` function as a
        // static class member method since it might have a different signature then the `ctorParameters`
        // method on the parent class which leads to TS complaining
        // instead we create an assignment to the class object right after class declaration:
        //   export class MyClass { }
        //   (MyClass as any).ctorParameters = function() { return [ ... ]; }
        //
        // `ctorParameters` does not exist on `MyClass` so we cast it to `any`
        if (node.heritageClauses && node.heritageClauses.some( hc => hc.token === ts.SyntaxKind.ExtendsKeyword)) {
          const statements: ts.Statement[] = [<any>super.visitClassDeclaration(<any>this.updateClassDeclaration(node, members))];

          const leftSideBase = ts.createParen(ts.createAsExpression(node.name, ts.createTypeReferenceNode('any', undefined)));
          const leftSide = ts.createPropertyAccess(leftSideBase, ts.createIdentifier('ctorParameters'));
          const rightSide = ts.createFunctionExpression(undefined, undefined, undefined, undefined, undefined, undefined, ts.createBlock( [ts.createReturn(ts.createArrayLiteral(ctorParams))] ));
          const statement = ts.createStatement(ts.createAssignment(leftSide, rightSide));
          statements.push(<any>statement);
          return statements as any;

        } else {
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
          return super.visitClassDeclaration(<any>this.updateClassDeclaration(node, members));
        }
      }
    }
    return super.visitClassDeclaration(node);
  }

  private updateClassDeclaration(node: ts.ClassDeclaration, members: ts.NodeArray<ts.ClassElement>) {
    const decorators = this.filterNodes(node.decorators, n => !this.isAngularDecorator(n));
    return ts.updateClassDeclaration(
      node,
      decorators.length > 0 ? node.decorators : undefined,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      members && members.length > 0 ? members : undefined
    );
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

    if (!this.mocker.hasFile(this.sourceFile.fileName)) {
      // we must use virtual files and not the actual file since previous loaders might have changed
      // the code.
      this.mocker.addVirtFile(this.sourceFile.fileName, this.sourceFile.text);
    }

    const typeName = this.ctorParameName(paramNode);

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

  private ctorParameName(paramNode: ts.ParameterDeclaration): string {
    let typeName = 'undefined';

    if (paramNode.type) {
      switch (paramNode.type.kind) {
        case ts.SyntaxKind.TypeReference:
          const checker: ts.TypeChecker = this.mocker.program.getTypeChecker();
          paramNode = utils.findRemoteMatch(<any>this.mocker.getSourceFile(this.sourceFile.fileName), <any>paramNode);

          const type = paramNode.type as ts.TypeReferenceNode;
          let symbolFlags = ts.SymbolFlags.None;

          if(checker) {
            const tsType = checker.getTypeFromTypeNode(type);
            if (tsType) {
              symbolFlags = tsType.symbol.flags;
            }
          }

          if ( symbolFlags && ( symbolFlags & ts.SymbolFlags.Interface
            || symbolFlags & ts.SymbolFlags.TypeAlias
            || symbolFlags & ts.SymbolFlags.TypeLiteral) ) {
            typeName = 'Object';
          } else if (type.typeName) {
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
}
