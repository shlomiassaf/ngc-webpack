import * as ts from 'typescript';
import { AngularCompilerPluginOptions } from '@ngtools/webpack';

export type BeforeRunHandler = ( resourceCompiler: { get(filename: string): Promise<string> }) => void | Promise<void>;
export type ResourcePathTransformer = (path: string) => string;
export type ResourceTransformer = (path: string, source: string) => string | Promise<string>;
export type ReadFileTransformer = {
  predicate: RegExp | ( (path: string) => boolean ),
  transform: (path: string, source: string) => string
};


export interface NgcWebpackPluginOptions extends AngularCompilerPluginOptions {

  /**
   * An alias for `AngularCompilerPluginOptions.skipCodeGeneration` simply to make it more readable.
   * If `skipCodeGeneration` is set, this value is ignored.
   * If this value is not set, the default value is taken from `skipCodeGeneration`
   * (which means AOT = true)
   */
  AOT?: boolean;

  /**
   * A hook that invokes before the plugin start the compilation process (compiler 'run' event).
   * ( resourceCompiler: { get(filename: string): Promise<string> }) => Promise<void>;
   *
   * The hook accepts a resource compiler which able (using webpack) to perform compilation on
   * files using webpack's loader chain and return the final content.
   * @param resourceCompiler
   */
  beforeRun?: BeforeRunHandler

  /**
   * Transform a source file (ts, js, metadata.json, summery.json).
   * If `predicate` is true invokes `transform`
   *
   * > Run's in both AOT and JIT mode on all files, internal and external as well as resources.
   *
   *
   *  - Do not apply changes to resource files using this hook when in AOT mode, it will not commit.
   *  - Do not apply changes to resource files in watch mode.
   *
   * Note that source code transformation is sync, you can't return a promise (contrary to `resourcePathTransformer`).
   * This means that you can not use webpack compilation (or any other async process) to alter source code context.
   * If you know the files you need to transform, use the `beforeRun` hook.
   */
  readFileTransformer?: ReadFileTransformer;


  /**
   * Transform the path of a resource (html, css, etc)
   * (path: string) => string;
   *
   * > Run's in AOT mode only and on metadata resource files (templateUrl, styleUrls)
   */
  resourcePathTransformer?: ResourcePathTransformer;

  /**
   * Transform a resource (html, css etc)
   * (path: string, source: string) => string | Promise<string>;
   *
   * > Run's in AOT mode only and on metadata resource files (templateUrl, styleUrls)
   */
  resourceTransformer?: ResourceTransformer;

  /**
   * Add custom TypeScript transformers to the compilation process.
   *
   * Transformers are applied after the transforms added by `@angular/compiler-cli` and
   * `@ngtools/webpack`.
   *
   * > `after` transformers are currently not supported.
   */
  tsTransformers?: ts.CustomTransformers;
}