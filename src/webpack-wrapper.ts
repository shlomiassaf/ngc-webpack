import * as webpack from 'webpack';
import { UserError } from '@angular/tsc-wrapped';

import { NgcWebpackPlugin } from './plugin';

export class WebpackWrapper {
  public compiler: any;
  public config: any;
  public plugin: NgcWebpackPlugin;

  private hasPlugin: boolean;

  constructor(private webpackConfigPath: string) { }

  init(): void {
    try {
      const config = require(this.webpackConfigPath);
      this.config = typeof config === 'function' ? config() : config;
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