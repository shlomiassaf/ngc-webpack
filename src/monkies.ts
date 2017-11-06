import * as ts from 'typescript';
import { AngularCompilerPlugin } from '@ngtools/webpack';

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