import * as webpack from 'webpack';
import { ModuleResolutionHost } from 'typescript';
import { ModuleResolutionHostAdapter } from '@angular/compiler-cli' ;

import { WebpackResourceLoader } from './webpack-resource-loader';
import { NgcWebpackPlugin, PathTransformer } from './plugin';

export class WebpackChainModuleResolutionHostAdapter extends ModuleResolutionHostAdapter {
  public compiler: any;
  private _loader: WebpackResourceLoader;
  private _pathTransformer: PathTransformer;

  constructor(host: ModuleResolutionHost, webpackConfig: any) {
    super(host);
    this.compiler = webpack(webpackConfig());
    this._loader = new WebpackResourceLoader(this.compiler.createCompilation());

    const plugin: NgcWebpackPlugin = this.compiler.options.plugins
      .filter( p => p instanceof NgcWebpackPlugin)[0];

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

    return this._loader.get(path);
  }
}
