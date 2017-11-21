import { NgcWebpackPluginOptions as NgcOptions } from './plugin-options'
import { MonkeyAngularCompilerPlugin } from './execution-models';

export function hasHook(options: NgcOptions, name: Array<keyof NgcOptions>): boolean[];
export function hasHook(options: NgcOptions, name: keyof NgcOptions): boolean;
export function hasHook(options: NgcOptions, name: keyof NgcOptions | Array<keyof NgcOptions>): boolean | boolean[] {
  if (Array.isArray(name)) {
    return name.map( n => typeof options[n] === 'function' );
  } else {
    return typeof options[name] === 'function';
  }
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


export function promiseWrapper<T>() {
  const wrapper: { promise: Promise<T>; resolve: (value?: T) => void; reject: (reason?: any) => void } = <any> {};
  wrapper.promise = new Promise<T>( (res, rej) => { wrapper.resolve = res; wrapper.reject = rej; });
  return wrapper;
}

// taken from:
// https://github.com/notenoughneon/typed-promisify/blob/master/index.ts
export function promisify<T>(f: (cb: (err: any, res: T) => void) => void, thisContext?: any): () => Promise<T>;
export function promisify<A, T>(f: (arg: A, cb: (err: any, res: T) => void) => void, thisContext?: any): (arg: A) => Promise<T>;
export function promisify<A, A2, T>(f: (arg: A, arg2: A2, cb: (err: any, res: T) => void) => void, thisContext?: any): (arg: A, arg2: A2) => Promise<T>;
export function promisify<A, A2, A3, T>(f: (arg: A, arg2: A2, arg3: A3, cb: (err: any, res: T) => void) => void, thisContext?: any): (arg: A, arg2: A2, arg3: A3) => Promise<T>;
export function promisify<A, A2, A3, A4, T>(f: (arg: A, arg2: A2, arg3: A3, arg4: A4, cb: (err: any, res: T) => void) => void, thisContext?: any): (arg: A, arg2: A2, arg3: A3, arg4: A4) => Promise<T>;
export function promisify<A, A2, A3, A4, A5, T>(f: (arg: A, arg2: A2, arg3: A3, arg4: A4, arg5: A5, cb: (err: any, res: T) => void) => void, thisContext?: any): (arg: A, arg2: A2, arg3: A3, arg4: A4, arg5: A5) => Promise<T>;

export function promisify(f: any, thisContext?: any) {
  return function () {
    let args = Array.prototype.slice.call(arguments);
    return new Promise((resolve, reject) => {
      args.push((err: any, result: any) => err !== null ? reject(err) : resolve(result));
      f.apply(thisContext, args);
    });
  }
}