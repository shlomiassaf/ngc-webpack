import * as Path from 'path';
import { NgcCliOptions } from '@angular/compiler-cli';
import { run, isCli } from './main';
import { WebpackWrapper } from "./webpack-wrapper";

export type PathTransformer = (path: string) => string;
export type SourceTransformer = (path: string, source: string) => string | Promise<string>;
export type OnCompilationSuccess = () => void;
export type OnCompilationError = (err: Error) => void;

export interface NgcWebpackPluginOptions {
  /**
   * If false the plugin is a ghost, it will not perform any action.
   * This property can be used to trigger AOT on/off depending on your build target (prod, staging etc...)
   *
   * The state can not change after initializing the plugin.
   * @default true
   */
  disabled?: boolean;

  pathTransformer?: PathTransformer;
  sourceTransformer?: SourceTransformer;
  onCompilationSuccess?: OnCompilationSuccess;
  onCompilationError?: OnCompilationError;

  /**
   * A path to a tsconfig file, if set the AOT compilation is triggered from the plugin.
   * When setting a tsconfig you do not need to run the compiler from the command line.
   *
   * @default undefined
   */
  tsConfig?: string;

  /**
   * A path to a file (resource) that will replace all resource referenced in @Components.
   * For each `@Component` the AOT compiler compiles it creates new representation for the templates (html, styles)
   * of that `@Components`. It means that there is no need for the source templates, they take a lot of
   * space and they will be replaced by the content of this resource.
   *
   * To leave the template as is set to a falsy value (the default).
   *
   * TIP: Use an empty file as an overriding resource. It is recommended to use a ".js" file which
   * usually has small amount of loaders hence less performance impact.
   *
   * > This feature is doing NormalModuleReplacementPlugin for AOT compiled resources.
   * @default undefined
   */
  resourceOverride?: string;

  /**
   * Angular compiler CLI options
   */
  cliOptions?: any;
}

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
      run(this.options.tsConfig, new NgcCliOptions(this.options.cliOptions || {}), this.webpackWrapper)
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