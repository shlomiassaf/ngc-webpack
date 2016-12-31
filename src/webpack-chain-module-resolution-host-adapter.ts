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

    const plugin = this.webpackWrapper.plugin;
    if (plugin && typeof plugin.options.pathTransformer === 'function') {
      this._pathTransformer = plugin.options.pathTransformer;
    }
  }

  readResource(path: string): Promise<string> {

    if (this._pathTransformer) {
      path = this._pathTransformer(path);
      if (path === '') {
        return Promise.resolve(path);
      }
    }

    if (!this.fileExists(path)) {
      throw new Error(`Compilation failed. Resource file not found: ${path}`);
    }

    return this._loader.get(path);
  }
}
