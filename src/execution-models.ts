import * as ts from 'typescript';
import { AngularCompilerPlugin } from '@ngtools/webpack';
import { NgcWebpackPluginOptions } from './plugin-options'

/**
 * An execution host is a logical unit that knows how to execute a compilation task.
 *
 * An execution host is the logic that drives an `NgcWebpackPlugin` instance, which makes `NgcWebpackPlugin` an extensible
 * shell.
 *
 * With this abstraction, `NgcWebpackPlugin` can be used for different tasks.
 * For example, a proxy to `AngularCompilerPlugin` in application mode or an `ngc` executer in library mode.
 *
 * The role of `NgcWebpackPlugin` is to configure the hooks `ngc-webpack` allow.
 */
export interface NgcCompilerExecutionHost {
  /**
   * Invoke the compilation process.
   */
  execute(compiler: any): void;

  /**
   * The compiler host used in the execution.
   */
  compilerHost: NgcCompilerHost;

  /**
   * Transformers to be used in the compilation, `NgcWebpackPlugin` can use this to push transformers.
   */
  transformers: ts.TransformerFactory<ts.SourceFile>[];

  /**
   * A List of `ngc-webpack` hook overrides this execution host implements internally.
   */
  hookOverride?: {
    [K in keyof NgcWebpackPluginOptions]?: (opt: NgcWebpackPluginOptions[K]) => void
    }
}

export interface NgcCompilerHost extends ts.CompilerHost {
  resourceLoader?: { get(filePath: string): Promise<string> };
  readResource?(fileName: string): Promise<string> | string;
}


/*
  We are hacking through private variables in `AngularCompilerPlugin`
  This is not optimal but a validation is done to be safe.
 */


export interface MonkeyWebpackResourceLoader {
  get(filePath: string): Promise<string>;
}

export interface MonkeyWebpackCompilerHost extends ts.CompilerHost {
  _files: {[path: string]: any | null};
  _resourceLoader?: MonkeyWebpackResourceLoader | undefined;
  readResource?(fileName: string): Promise<string> | string;
}

export interface MonkeyAngularCompilerPlugin extends Pick<AngularCompilerPlugin, 'apply'> {
  _compilerHost: MonkeyWebpackCompilerHost;
  _transformers: ts.TransformerFactory<ts.SourceFile>[];
}