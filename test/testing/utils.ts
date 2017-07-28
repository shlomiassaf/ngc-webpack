import * as webpack from 'webpack';
import { spawn as spawnFactory } from 'child_process';
import * as fs from 'fs';
import * as Path from 'path';

export type Compiler = webpack.compiler.Compiler;
export type Stats = webpack.compiler.Stats;

process.env.NODE_ENV = 'production';

export const configs = {
  cli: {
    ts: Path.resolve('tsconfig.cli.json'),
    wp: Path.resolve('test/testing/buildConfig/webpack.cli.js')
  },
  ngc: {
    ts: Path.resolve('tsconfig.ngc.json'),
    wp: Path.resolve('test/testing/buildConfig/webpack.ngc.js')
  },
  plugin: {
    ts: Path.resolve('tsconfig.plugin.json'),
    wp: Path.resolve('test/testing/buildConfig/webpack.plugin.js')
  },
  aotTransform: {
    ts: Path.resolve('tsconfig.aot-transformer.json'),
    wp: Path.resolve('test/testing/buildConfig/webpack.aot-transformer.js')
  }
};

/**
 * Returns a webpack configuration object.
 * You can supply args to be used if the config is a function (webpack config factory)
 *
 * Also support ES6 default exports.
 * @param config
 * @param args
 * @returns {any}
 */
export function resolveWebpackConfig(config: any, ...args: any[]): any {
  if (typeof config === 'function') {
    return config(...args);
  } else if (config.__esModule === true && !!config.default) {
    return resolveWebpackConfig(config.default, ...args);
  } else {
    return config;
  }
}

/**
 * Run webpack based on a webpack config
 * @param config a webpack config object, can be a function, es6 default exported function, or object.
 */
export function runWebpack(config: any): { compiler: Compiler, done: Promise<Stats> } {
  const compiler = webpack(resolveWebpackConfig(config));
  return {
    compiler,
    done: new Promise( (RSV, RJT) => compiler.run((err, stats) => err ? RJT(err) : RSV(stats)) )
  }
}

/**
 * Simple spawn wrapper that accepts a raw command line (with args) and return a promise with the result.
 * All IO goes to the console.
 * @param cmd
 * @returns {Promise<T>}
 */
export function spawn(cmd): Promise<any> {
  return new Promise( (resolve, reject) => {
    const args = cmd.split(' ');
    const spawnInstance = spawnFactory(args.shift(), args, {stdio: "inherit"});

    spawnInstance.on('exit', function (code) {
      if (code === 0) {
        resolve();
      } else {
        reject(code);
      }
    });
  });
}

export function getTsConfigMeta(tsConfigPath: string): {tsConfig: any, absGenDir: string} {
  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
  return {
    tsConfig,
    absGenDir: Path.resolve(Path.dirname(tsConfigPath), tsConfig.angularCompilerOptions.genDir)
  }
}

export function occurrences(regex: RegExp, str: string): number {
  if (!regex.global || !regex.multiline) {
    throw new Error('Must use a multi & global regex');
  }

  let count = 0;
  let match = regex.exec(str);

  while (match) {
    count++;
    match = regex.exec(str);
  }

  return count;
}