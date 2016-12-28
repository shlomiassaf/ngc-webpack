import * as webpack from 'webpack';
import { ModuleResolutionHost } from 'typescript';
import { ModuleResolutionHostAdapter } from '@angular/compiler-cli' ;

import { WebpackResourceLoader } from './webpack-resource-loader';

function getLoader(config: any): WebpackResourceLoader {
  const compiler: any = webpack(config());
  return new WebpackResourceLoader(compiler.createCompilation());
}


export class WebpackChainModuleResolutionHostAdapter extends ModuleResolutionHostAdapter {
  private _loader: WebpackResourceLoader;

  constructor(host: ModuleResolutionHost, webpackConfig: any) {
    super(host);
    this._loader = getLoader(webpackConfig);
  }

  readResource(path: string): Promise<string> {
    return this._loader.get(path);
  }
}
