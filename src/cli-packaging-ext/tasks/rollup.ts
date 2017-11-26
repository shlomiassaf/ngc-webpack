// mostly taken from https://github.com/angular/material2/blob/master/tools/package-tools/build-bundles.ts
import * as rollup from 'rollup';
import * as resolve from 'rollup-plugin-node-resolve';

function getRollupConfigMap() {
  const version = rollup['VERSION'].split('.').slice(0, 2).map(Number);

  const RollupOptions48 = {
    input: 'input',
    file: 'file',
    name: 'name',
    sourcemap: 'sourcemap',
    sourcemapFile: 'sourcemapFile',
    strict: 'strict',
  };
  const RollupOptionsPre48 = {
    input: 'entry',
    file: 'dest',
    name: 'moduleName',
    sourcemap: 'sourceMap',
    sourcemapFile: 'sourceMapFile',
    strict: 'useStrict',
  };

  return version[0] === 0 && version[1] < 48 ? RollupOptionsPre48 : RollupOptions48;
}

const RollupConfigMap = getRollupConfigMap();

export type RollupBundleConfig = {
  entry: string;
  dest: string;
  format: string;
  moduleName: string;
  external?: string[];
  globals?: { [key: string]: string };
  sourceMap?: boolean;
};

/** Creates a rollup bundle of a specified JavaScript file.*/
export async function createRollupBundle(config: RollupBundleConfig): Promise<any> {
  const bundleOptions: any = {
    context: 'this',
    external: config.external,
    [RollupConfigMap.input]: config.entry,
  };

  const writeOptions = {
    // Keep the moduleId empty because we don't want to force developers to a specific moduleId.
    moduleId: '',
    [RollupConfigMap.name]: config.moduleName,
    // banner: buildConfig.licenseBanner,
    format: config.format,
    [RollupConfigMap.file]: config.dest,
    globals: config.globals,
    [RollupConfigMap.sourcemap]: config.sourceMap
  };

  // When creating a UMD, we want to exclude tslib from the `external` bundle option so that it
  // is inlined into the bundle.
  if (config.format === 'umd') {
    bundleOptions.plugins = [resolve()];

    if (bundleOptions.external && bundleOptions.external.indexOf('tslib') > -1) {
      bundleOptions.external.splice(bundleOptions.external.indexOf('tslib'), 1);
    }
  }

  return rollup.rollup(bundleOptions).then((bundle: any) => bundle.write(writeOptions));
}