import * as Path from 'path';
import * as FS from 'fs-extra';
import { CompilationResult } from '../../cli/util';
import { PackagedBuildConfig } from '../schema/packaged-build-config';
import { createBundleInfo } from './bundle-info';
import { createRollupBundle, RollupBundleConfig } from './rollup';
import { remapSourceMap } from './sourcemap';
import { minify } from './minify';
import { mainPackageJson, secondaryPackageJson } from './package-json';

function parseExternals(dict: { [key: string]: string | false }) {
  const external = Object.keys(dict);
  const globals = external.reduce( (obj, key) => {
    const value = dict[key];
    if (value && typeof value === 'string') {
      obj[key] = value;
    }
    return obj;
  }, {} as { [key: string]: string });

  return { globals, external };
}

export class TaskPhaseEvent {
  constructor(public task: 'TASK' | 'TS' | 'Rollup' | 'Minify' | 'Cleanup' | 'packageJson',
              public subtask: 'ES5' | 'ES2015' | 'UMD' | 'None',
              public phase: 'start' | 'end',
              public buildConfig: PackagedBuildConfig) { }
}

export async function runTasks(buildConfig: PackagedBuildConfig,
                               runES2015: () => Promise<CompilationResult>,
                               runES5: () => Promise<CompilationResult>,
                               progress?: (event: TaskPhaseEvent) => void) {

  if (!progress) {
    progress = <any> (() => {});
  }

  progress(new TaskPhaseEvent('TASK', 'None', 'start', buildConfig));

  // invoke ES5 compilation if we need es5 bundle or umd bundle.
  const invokeES5 = ! (buildConfig.disableFeatures.es5 && buildConfig.disableFeatures.umd);
  // invoke es2015 compilation if we invoked es5 AND ALSO need es2015 bundle
  const invokeES2015 = invokeES5 && !buildConfig.disableFeatures.es2015;
  // NOTE that at least one compilation will always run. invokeES2015 effects the 2nd compilation pass
  // if the first pass is not ES5 then ES2015 will run instead (and not run in 2nd pass)

  progress(new TaskPhaseEvent('TS', invokeES5 ? 'ES5' : 'ES2015', 'start', buildConfig));
  let parsedDiagnostics: CompilationResult = await (invokeES5 ? runES5() : runES2015());
  if (parsedDiagnostics.error) {
    return parsedDiagnostics;
  }
  progress(new TaskPhaseEvent('TS', invokeES5 ? 'ES5' : 'ES2015', 'end', buildConfig));

  const dstRoot = parsedDiagnostics.result.sourceToOutMapper(Path.resolve(buildConfig.metaDir));
  const bundleInfo = await createBundleInfo(dstRoot, buildConfig);

  const baseRollupBundleConfig: RollupBundleConfig = {
    moduleName: buildConfig.moduleName,
    entry: bundleInfo.entryFile,
    dest: undefined,
    format: undefined,
    sourceMap: bundleInfo.sourceMap,
    ...parseExternals(buildConfig.externals)
  };

  const rollup = async (rollupConfig: Partial<RollupBundleConfig>, sourceMap: boolean) => {
    const cfg = Object.assign({}, baseRollupBundleConfig, rollupConfig);
    await createRollupBundle(cfg);

    if (sourceMap) {
      await remapSourceMap(cfg.dest, { inline: false, includeContent: true });
    }
  };

  if (!buildConfig.disableFeatures.es5) {
    progress(new TaskPhaseEvent('Rollup', 'ES5', 'start', buildConfig));
    await rollup({ dest: bundleInfo.dest.esm5, format: 'es' }, bundleInfo.sourceMap);
    progress(new TaskPhaseEvent('Rollup', 'ES5', 'end', buildConfig));
  }

  if (!buildConfig.disableFeatures.umd) {
    progress(new TaskPhaseEvent('Rollup', 'UMD', 'start', buildConfig));
    await rollup({ dest: bundleInfo.dest.umd, format: 'umd', entry: bundleInfo.dest.esm5}, bundleInfo.sourceMap);
    progress(new TaskPhaseEvent('Rollup', 'UMD', 'end', buildConfig));


    if (!buildConfig.disableFeatures.umdMinify) {
      progress(new TaskPhaseEvent('Minify', 'UMD', 'start', buildConfig));
      await minify(bundleInfo.dest.umd, bundleInfo.dest.umdMin, {
        sourceMapFileName: bundleInfo.sourceMap,
        gzipFileName: !buildConfig.disableFeatures.umdGzip
      });
      progress(new TaskPhaseEvent('Minify', 'UMD', 'end', buildConfig));
    }
  }


  if (invokeES2015) {
    progress(new TaskPhaseEvent('TS', 'ES2015', 'start', buildConfig));
    parsedDiagnostics = await runES2015();
    if (parsedDiagnostics.error) {
      return parsedDiagnostics;
    }
    progress(new TaskPhaseEvent('TS', 'ES2015', 'end', buildConfig));
  }

  if (!buildConfig.disableFeatures.es2015) {
    progress(new TaskPhaseEvent('Rollup', 'ES2015', 'start', buildConfig));
    await rollup({ dest: bundleInfo.dest.esm2015, format: 'es' }, bundleInfo.sourceMap);
    progress(new TaskPhaseEvent('Rollup', 'ES2015', 'end', buildConfig));
  }

  // TODO: maybe we can hook into the compiler-host and skip file-system emit for *.js files
  //       and save them in-memory, then use rollup virtual FS plugin (rollup-plugin-hypothetical) to define the
  //       files, this can also reduce AOT builds, no emitted declarations in the 2nd pass.
  progress(new TaskPhaseEvent('Cleanup', 'None', 'start', buildConfig));
  for (let file of parsedDiagnostics.result.emitResult.emittedFiles) {
    if (file.endsWith('.js')) {
      await FS.remove(file);
    }
  }
  progress(new TaskPhaseEvent('Cleanup', 'None', 'end', buildConfig));

  progress(new TaskPhaseEvent('packageJson', 'None', 'start', buildConfig));
  if (!buildConfig.parent) {
    await mainPackageJson(bundleInfo);
  } else {
    await secondaryPackageJson(bundleInfo, buildConfig);
  }
  progress(new TaskPhaseEvent('packageJson', 'None', 'end', buildConfig));

  progress(new TaskPhaseEvent('TASK', 'None', 'end', buildConfig));
}