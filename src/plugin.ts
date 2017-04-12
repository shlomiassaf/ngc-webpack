import * as Path from 'path';
import { NgcCliOptions } from '@angular/compiler-cli';
import { run, isCli } from './main';
import { WebpackWrapper } from "./webpack-wrapper";
import { WebpackResourceLoader } from './webpack-resource-loader';
import { NgcWebpackPluginOptions } from './plugin-options'


export class NgcWebpackPlugin {
  public compiler: any;
  public webpackWrapper: WebpackWrapper;

  private aotPass: boolean;
  private debug = true;

  constructor(public options: NgcWebpackPluginOptions = {} as any) {
    if (!options.hasOwnProperty('disabled')) {
      options.disabled = false;
    }
  }

  apply(compiler: any) {
    if (this.options.disabled === true) return;

    this.compiler = compiler;
    this.webpackWrapper = WebpackWrapper.fromCompiler(this.compiler);

    // if not from cli and no config file then we never have AOT pass...
    this.aotPass = !isCli() && !this.options.tsConfig ? false : true;

    compiler.plugin('run', (compiler, next) => this.run(next) );
    compiler.plugin('watch-run', (compiler, next) => this.run(next) );
    compiler.plugin('emit', (compilation, next) => this.emit(compilation, next) );

    compiler.plugin("normal-module-factory", (nmf: any) => {
      nmf.plugin('before-resolve', (result, callback) => this.beforeResolve(result, callback) );
      nmf.plugin('after-resolve', (result, callback) => this.afterResolve(result, callback) );
    });
  }

  emit(compilation: any, next: (err?: Error) => any): void {
    if (!!this.options.resourceOverride && this.webpackWrapper.externalAssetsSource) {
      const externalAssets = this.webpackWrapper.externalAssetsSource.externalAssets || {};
      Object.keys(externalAssets).forEach( k => compilation.assets[k] = externalAssets[k] );
    }

    next();
  }

  run(next: (err?: Error) => any): void {
    if (this.options.tsConfig) {
      if (this.debug) {
        console.log('Starting compilation using the angular compiler.');
      }

      let p: Promise<void>;
      if (typeof this.options.beforeRun === 'function') {
        const loader = new WebpackResourceLoader(this.webpackWrapper.compiler.createCompilation(), !!this.options.resourceOverride);
        p = this.options.beforeRun(loader);
      } else {
        p = Promise.resolve();
      }

      p.then( () => run(this.options.tsConfig, new NgcCliOptions(this.options.cliOptions || {}), this.webpackWrapper) )
        .then( () => undefined ) // ensure the last then get's undefined if no error.
        .catch(err => err)
        .then(err => {
          if (this.debug) {
            console.log('Angular compilation done, starting webpack bundling.');
          }
          this.aotPass = false;
          next(err)
        });
    } else {
      next();
    }
  }

  beforeResolve(result: any, callback: (err: Error | null, result) => void): void {
    if (!this.aotPass && this.options.resourceOverride && this.webpackWrapper.aotResources[Path.normalize(result.request)] === true) {
      result.request = this.options.resourceOverride;
    }
    callback(null, result);
  }

  afterResolve(result: any, callback: (err: Error | null, result) => void): void {
    if (!this.aotPass && this.options.resourceOverride && this.webpackWrapper.aotResources[Path.normalize(result.resource)] === true) {
      result.resource = Path.resolve(Path.dirname(result.resource), this.options.resourceOverride);
    }
    callback(null, result);
  }
}