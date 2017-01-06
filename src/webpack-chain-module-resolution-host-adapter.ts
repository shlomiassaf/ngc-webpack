import { ModuleResolutionHost } from 'typescript';
import { ModuleResolutionHostAdapter } from '@angular/compiler-cli' ;

import { WebpackResourceLoader } from './webpack-resource-loader';
import { PathTransformer } from './plugin';
import { WebpackWrapper } from './webpack-wrapper';

export class WebpackChainModuleResolutionHostAdapter extends ModuleResolutionHostAdapter {
  private _loader: WebpackResourceLoader;
  private _pathTransformer: PathTransformer;

  constructor(host: ModuleResolutionHost, public webpackWrapper: WebpackWrapper) {
    super(host);
    this._loader = new WebpackResourceLoader(this.webpackWrapper.compiler.createCompilation());
  }

  readResource(path: string): Promise<string> {

    const newPath = this.webpackWrapper.pathTransformer(path);

    if (newPath === '') {
      return Promise.resolve(newPath);
    } else if (!this.fileExists(newPath)) {
      throw new Error(`Compilation failed. Resource file not found: ${newPath}`);
    } else {
      return this._loader.get(newPath);
    }

  }
}
