import { NgcWebpackPluginOptions as NgcOptions } from './plugin-options'
import { MonkeyAngularCompilerPlugin } from './monkies';

export function hasHook(options: NgcOptions, name: Array<keyof NgcOptions>): boolean[];
export function hasHook(options: NgcOptions, name: keyof NgcOptions): boolean;
export function hasHook(options: NgcOptions, name: keyof NgcOptions | Array<keyof NgcOptions>): boolean | boolean[] {
  if (Array.isArray(name)) {
    return name.map( n => typeof options[n] === 'function' );
  } else {
    return typeof options[name] === 'function';
  }
}

export function withHook<P extends keyof NgcOptions>(options: NgcOptions,
                                                     name: P,
                                                     run: (hook: NgcOptions[P]) => void): void {
  hasHook(options, name) && run(options[name]);
}

export function isValidAngularCompilerPlugin(instance: MonkeyAngularCompilerPlugin): boolean {
  return validators.every( m => m(instance) );
}

const validators: Array<(instance: MonkeyAngularCompilerPlugin) => boolean> = [
  (instance: MonkeyAngularCompilerPlugin) => Array.isArray(instance._transformers),
  (instance: MonkeyAngularCompilerPlugin) => !!instance._compilerHost,
  (instance: MonkeyAngularCompilerPlugin) => !!instance._compilerHost._resourceLoader,
  (instance: MonkeyAngularCompilerPlugin) => typeof instance._compilerHost._resourceLoader.get === 'function'
];