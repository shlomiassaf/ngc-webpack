import * as webpack from 'webpack';
import * as Path from 'path';
import { UserError } from '@angular/compiler-cli';

import { NgcWebpackPlugin } from './plugin';


/**
 * Resolve the config to an object.
 * If it's a fn, invoke.
 *
 * Also check if it's a mocked ES6 Module in cases where TS file is used that uses "export default"
 * @param config
 * @returns {any}
 */
function resolveConfig(config: any): any {
  if (typeof config === 'function') {
    return config();
  } else if (config.__esModule === true && !!config.default) {
    return resolveConfig(config.default);
  } else {
    return config;
  }
}

export function findPlugin(compiler: any): NgcWebpackPlugin {
  return compiler.options.plugins
    .filter( p => p instanceof NgcWebpackPlugin)[0];
}

export interface ExternalAssetsSource {
  externalAssets: any;
}

export class WebpackWrapper {
  public plugin: NgcWebpackPlugin;
  public aotResources: any = {}; //TODO: use Map if in node 5

  private hasPlugin: boolean;
  private _externalAssetsSource: ExternalAssetsSource;

  private constructor(public compiler: any) {
    this.plugin = findPlugin(compiler);

    this.hasPlugin = !!this.plugin;
  };

  get externalAssetsSource(): ExternalAssetsSource {
    return this._externalAssetsSource;
  }

  set externalAssetsSource(value: ExternalAssetsSource) {
    this._externalAssetsSource = value;
  }

  emitOnCompilationSuccess(): void {
    if (this.hasPlugin && typeof this.plugin.options.onCompilationSuccess === 'function') {
      this.plugin.options.onCompilationSuccess.call(this);
    }
  }

  emitOnCompilationError(err: Error): void {
    if (this.hasPlugin && typeof this.plugin.options.onCompilationError === 'function') {
      this.plugin.options.onCompilationError.call(this, err);
    }
  }

  resourcePathTransformer(path: string): string {
    this.aotResources[Path.normalize(path)] = true;

    const fn = this.plugin && (this.plugin.options.resourcePathTransformer || this.plugin.options.pathTransformer);

    if (typeof fn === 'function') {
      return fn(path);
    } else {
      return path;
    }
  }

  resourceTransformer(path: string, source: string): string | Promise<string> {
    const fn = this.plugin && (this.plugin.options.resourceTransformer || this.plugin.options.sourceTransformer);
    if (typeof fn === 'function') {
      return fn(path, source);
    } else {
      return source;
    }
  }

  readFileTransformer(path: string, source: string): string {
    if (this.plugin && typeof this.plugin.options.readFileTransformer === 'function') {
      return this.plugin.options.readFileTransformer(path, source);
    } else {
      return source;
    }
  }

  static fromConfig(webpackConfig: string | any): WebpackWrapper {
    try {
      let config: any;

      if (!webpackConfig) {
        webpackConfig = './webpack.config.js';
      }

      if (typeof webpackConfig === 'string') {
        let configPath = Path.isAbsolute(webpackConfig)
            ? webpackConfig
            : Path.join(process.cwd(), webpackConfig)
          ;

        config = require(configPath);
      } else {
        config = webpackConfig;
      }

      const configModule = resolveConfig(config);
      const compiler = webpack(configModule);

      // setting the plugin is not mandatory so we check if it exists.
      // if does it creates the wrapper, otherwise we need to create it.
      const plugin = findPlugin(compiler);
      return plugin ? plugin.webpackWrapper : WebpackWrapper.fromCompiler(compiler);
    } catch (err) {
      throw new UserError(`Invalid webpack configuration. Please set a valid --webpack argument.\n${err.message}`);
    }
  }

  static fromCompiler(compiler: any): WebpackWrapper {
    return new WebpackWrapper(compiler);
  }
}