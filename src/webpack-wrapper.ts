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
  public compiler: any;
  public config: any;
  public plugin: NgcWebpackPlugin;

  private hasPlugin: boolean;

  constructor(private webpackConfig: string | any) { }

  init(): void {
    try {
      let config: any;

      if (!this.webpackConfig) {
        this.webpackConfig = './webpack.config.js';
      }

      if (typeof this.webpackConfig === 'string') {
        let configPath = Path.isAbsolute(this.webpackConfig)
            ? this.webpackConfig
            : Path.join(process.cwd(), this.webpackConfig)
          ;

        config = require(configPath);
      } else {
        config = this.webpackConfig;
      }

      this.config = resolveConfig(config);
    } catch (err) {
      throw new UserError(`Invalid webpack configuration. Please set a valid --webpack argument.\n${err.message}`);
    }

    this.compiler = webpack(this.config);

    this.plugin = this.compiler.options.plugins
      .filter( p => p instanceof NgcWebpackPlugin)[0];

    this.hasPlugin = !!this.plugin;
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
}