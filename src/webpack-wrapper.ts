import * as webpack from 'webpack';
import * as Path from 'path';
import { UserError } from '@angular/tsc-wrapped';

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


export class WebpackWrapper {
  public plugin: NgcWebpackPlugin;
  public aotResources: any = {}; //TODO: use Map if in node 5

  private hasPlugin: boolean;


  private constructor(public compiler: any) {
    this.plugin = this.compiler.options.plugins
      .filter( p => p instanceof NgcWebpackPlugin)[0];

    this.hasPlugin = !!this.plugin;
  };

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

  pathTransformer(path: string): string {
    this.aotResources[path] = true;

    if (this.plugin && typeof this.plugin.options.pathTransformer === 'function') {
      return this.plugin.options.pathTransformer(path);
    } else {
      return path;
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
      return WebpackWrapper.fromCompiler(webpack(configModule));
    } catch (err) {
      throw new UserError(`Invalid webpack configuration. Please set a valid --webpack argument.\n${err.message}`);
    }
  }

  static fromCompiler(compiler: any): WebpackWrapper {
    return new WebpackWrapper(compiler);
  }
}