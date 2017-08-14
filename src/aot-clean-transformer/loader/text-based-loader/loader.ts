import * as Path from 'path';
import * as ts from 'typescript';
import { loader as l } from 'webpack';
const loaderUtils = require('loader-utils');

import { TypeScriptFileRefactor } from './refactor';
import { findPlugin } from '../../../webpack-wrapper';

function _angularImportsFromNode(node: ts.ImportDeclaration, _sourceFile: ts.SourceFile): string[] {
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


function _ctorParameterFromTypeReference(paramNode: ts.ParameterDeclaration,
                                         angularImports: string[],
                                         refactor: TypeScriptFileRefactor) {
  let typeName = 'undefined';
  if (paramNode.type) {
    switch (paramNode.type.kind) {
      case ts.SyntaxKind.TypeReference:
        const type = paramNode.type as ts.TypeReferenceNode;

        const tsType = refactor.program.getTypeChecker().getTypeFromTypeNode(type);
        if (tsType.symbol.flags & ts.SymbolFlags.Interface
          || tsType.symbol.flags & ts.SymbolFlags.TypeAlias
          || tsType.symbol.flags & ts.SymbolFlags.TypeLiteral) {
          typeName = 'Object';
        } else if (type.typeName) {
          typeName = type.typeName.getText(refactor.sourceFile);
        } else {
          typeName = type.getText(refactor.sourceFile);
        }
        break;
      case ts.SyntaxKind.AnyKeyword:
        typeName = 'undefined';
        break;
      default:
        typeName = 'null';
    }
  }

  const decorators = refactor.findAstNodes(paramNode, ts.SyntaxKind.Decorator) as ts.Decorator[];
  const decoratorStr = decorators
    .map(decorator => {
      const call =
        refactor.findFirstAstNode(decorator, ts.SyntaxKind.CallExpression) as ts.CallExpression;

      if (!call) {
        return null;
      }

      const fnName = call.expression.getText(refactor.sourceFile);
      const args = call.arguments.map(x => x.getText(refactor.sourceFile)).join(', ');
      if (angularImports.indexOf(fnName) === -1) {
        return null;
      } else {
        return [fnName, args];
      }
    })
    .filter(x => !!x)
    .map(([name, args]: string[]) => {
      if (args) {
        return `{ type: ${name}, args: [${args}] }`;
      }
      return `{ type: ${name} }`;
    })
    .join(', ');

  if (decorators.length > 0) {
    return `{ type: ${typeName}, decorators: [${decoratorStr}] }`;
  }
  return `{ type: ${typeName} }`;
}


function _addCtorParameters(classNode: ts.ClassDeclaration,
                            angularImports: string[],
                            refactor: TypeScriptFileRefactor) {
  // For every classes with constructors, output the ctorParameters function which contains a list
  // of injectable types.
  const ctor = (
    refactor.findFirstAstNode(classNode, ts.SyntaxKind.Constructor) as ts.ConstructorDeclaration);
  if (!ctor) {
    // A class can be missing a constructor, and that's _okay_.
    return;
  }

  const params = Array.from(ctor.parameters).map(paramNode => {
    return _ctorParameterFromTypeReference(paramNode, angularImports, refactor);
  });

  // Type script will complain if extending class static's ctorParameters method does not match parent
  if (classNode.heritageClauses && classNode.heritageClauses.some( hc => hc.token === ts.SyntaxKind.ExtendsKeyword)) {
    const ctorParametersDecl = `(${classNode.name.text} as any).ctorParameters = function () { return [ ${params.join(', ')} ]; }`;
    refactor.appendAfter(classNode.getLastToken(refactor.sourceFile), ctorParametersDecl);
  } else {
    const ctorParametersDecl = `static ctorParameters() { return [ ${params.join(', ')} ]; }`;
    refactor.prependBefore(classNode.getLastToken(refactor.sourceFile), ctorParametersDecl);
  }
}


function _removeDecorators(refactor: TypeScriptFileRefactor) {
  const angularImports: string[]
    = refactor.findAstNodes(refactor.sourceFile, ts.SyntaxKind.ImportDeclaration)
    .map((node: ts.ImportDeclaration) => _angularImportsFromNode(node, refactor.sourceFile))
    .reduce((acc: string[], current: string[]) => acc.concat(current), []);

  const marker = [];

  // Find all decorators.
  refactor.findAstNodes(refactor.sourceFile, ts.SyntaxKind.Decorator)
    .forEach(node => {
      // First, add decorators to classes to the classes array.
      if (node.parent) {
        const declarations = refactor.findAstNodes(node.parent,
          ts.SyntaxKind.ClassDeclaration, false, 1);
        if (declarations.length > 0 && marker.indexOf(declarations[0]) === -1) {
          marker.push(declarations[0]);
          _addCtorParameters(declarations[0] as ts.ClassDeclaration, angularImports, refactor);
        }
      }

      refactor.findAstNodes(node, ts.SyntaxKind.CallExpression)
        .filter((node: ts.CallExpression) => {
          const fnName = node.expression.getText(refactor.sourceFile);
          if (fnName.indexOf('.') != -1) {
            // Since this is `a.b`, see if it's the same namespace as a namespace import.
            return angularImports.indexOf(fnName.replace(/\..*$/, '') + '.') != -1;
          } else {
            return angularImports.indexOf(fnName) != -1;
          }
        })
        .forEach(() => refactor.removeNode(node));
    });
}

function getDiagnostics(program: ts.Program, sourceFile: ts.SourceFile, typeCheck = true): ts.Diagnostic[] {
  let diagnostics: ts.Diagnostic[] = [];
  // only concat the declaration diagnostics if the tsconfig config sets it to true.

  diagnostics = diagnostics.concat(program.getOptionsDiagnostics());

  diagnostics = diagnostics.concat(program.getGlobalDiagnostics());

  if (program.getCompilerOptions().declaration == true) {
    diagnostics = diagnostics.concat(program.getDeclarationDiagnostics(sourceFile));
  }

  diagnostics = diagnostics.concat(
    program.getSyntacticDiagnostics(sourceFile),
    typeCheck ? program.getSemanticDiagnostics(sourceFile) : []);

  return diagnostics;
}

let program: ts.Program;
let compilerHost: ts.CompilerHost;
let AOTMode: boolean;

export interface AotCleanupLoaderOptions {
  /**
   * If false the plugin is a ghost, it will not perform any action.
   * This property can be used to trigger AOT on/off depending on your build target (prod, staging etc...)
   *
   * The state can not change after initializing the plugin.
   * @default true
   */
  disable?: false;

  /**
   * A path to a TSConfig file, optional if a plugin is supplied.
   * When both are available `tsConfigPath` wins.
   */
  tsConfigPath?: any;

  /**
   * Optional TS compiler options.
   *
   * > Some options set by the loader can not change.
   */
  compilerOptions?: any;
}

/**
 * Reset the loader, allows running a new program on the same session.
 * @internal
 */
export function resetLoader(): void {
  program = compilerHost = AOTMode = undefined;
}

export function aotCleanLoader(this: l.LoaderContext & { _compilation: any }, source: string | null, sourceMap: string | null) {
  const cb = this.async();
  const sourceFileName: string = this.resourcePath;

  if (AOTMode === false || sourceFileName.endsWith('ngfactory.ts')) {
    return cb(null, source, sourceMap);
  }

  if (!program) {
    try {
      const self = this;
      const plugin = findPlugin(self._compilation);
      const options: AotCleanupLoaderOptions = loaderUtils.getOptions(this) || {};

      if (options.disable === false) {
        AOTMode = true;
      } else {
        AOTMode = false;
        return cb(null, source, sourceMap);
      }

      let tsConfigPath: string = options.tsConfigPath;

      if (!tsConfigPath && plugin) {
        tsConfigPath = plugin.options.tsConfig;
      }

      if (tsConfigPath === undefined) {
        throw new Error('aot-transformer is being used as a loader but no `tsConfigPath` option nor '
          + 'NgcWebpackPlugin was detected. You must provide at least one of these.'
        );
      }

      const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      if (tsConfig.error) {
        throw tsConfig.error;
      }

      for (const key of Object.keys(options)) {
        if (key == 'tsConfigPath') {
          continue;
        }
        tsConfig.config.compilerOptions[key] = options[key];
      }

      tsConfig.config.compilerOptions.strictNullChecks = false;
      tsConfig.config.compilerOptions.declaration = false;
      tsConfig.config.compilerOptions.diagnostics = false;
      tsConfig.config.compilerOptions.noEmit = true;
      tsConfig.config.compilerOptions.skipLibCheck = true;

      const parsedConfig = ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, Path.dirname(tsConfigPath));

      compilerHost = ts.createCompilerHost(parsedConfig.options);
      program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    } catch (err) {
      return cb(err);
    }
  }

  program.emit(program.getSourceFile(sourceFileName), <any> (()=>{}) );

  const diagnostics = getDiagnostics(program, program.getSourceFile(sourceFileName));
  if (diagnostics.length >= 1) {
    const errors = diagnosticsToErrors(diagnostics);
    if (errors.length === 1) {
      cb(errors[0]);
    } else {
      for (let e of errors) {
        this.emitError(<any>e);
      }
      cb(new Error('NgcWebpack AotCleanupLoader: Multiple Errors'));
    }
  } else {
    try {
      const refactor = new TypeScriptFileRefactor(sourceFileName, program.getCompilerOptions(), <any>compilerHost, <any>program, source);
      _removeDecorators(refactor);
      cb(null, refactor.sourceText);
    } catch (err) {
      cb(err);
    }
  }
}

function diagnosticsToErrors(diagnostics: ts.Diagnostic[]): Error[] {
  const errors: Error[] = [];
  diagnostics.forEach( d => {
    const msg = d.messageText;
    if (typeof msg === 'string') {
      errors.push(new Error(msg));
    } else {
      let chain: ts.DiagnosticMessageChain = <any>d;
      while (chain) {
        if (chain.category = ts.DiagnosticCategory.Error) {
          errors.push(new Error(chain.messageText));
        }
        chain = chain.next;
      }
    }
  });
  return errors;
}
