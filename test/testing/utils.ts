import * as webpack from 'webpack';
import { spawn as spawnFactory } from 'child_process';
import * as fs from 'fs';
import * as Path from 'path';

export type Compiler = webpack.Compiler;
export type Stats = webpack.Stats;

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

export function logWebpackStats(stats: Stats) {
  console.log('Total Memory:');
  const memUse = process.memoryUsage();
  ['rss', 'heapTotal', 'heapUsed', 'external'].forEach( k => memUse[k] = pretty(memUse[k]));

  console.log(JSON.stringify(memUse, null, 2));
  console.log(`${stats['endTime'] - stats['startTime']} ms [${Math.ceil((stats['endTime'] - stats['startTime']) / 1000)} secs]`);

  stats.toJson().assets.forEach( a => {
    console.log(`${a.name}: ${pretty(a.size)}`)
  })
}

//https://github.com/davglass/prettysize/blob/master/index.js
function pretty (size, nospace?, one?, places?) {
  const sizes = [ 'Bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB' ];

  let mysize, f;
  places = places || 1;

  sizes.forEach(function(f, id) {
    if (one) {
      f = f.slice(0, 1);
    }
    var s = Math.pow(1024, id),
      fixed;
    if (size >= s) {
      fixed = String((size / s).toFixed(places));
      if (fixed.indexOf('.0') === fixed.length - 2) {
        fixed = fixed.slice(0, -2);
      }
      mysize = fixed + (nospace ? '' : ' ') + f;
    }
  });

  // zero handling
  // always prints in Bytes
  if (!mysize) {
    f = (one ? sizes[0].slice(0, 1) : sizes[0]);
    mysize = '0' + (nospace ? '' : ' ') + f;
  }

  return mysize;
}