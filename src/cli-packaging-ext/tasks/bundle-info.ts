import * as Path from 'path';
import { PackagedBuildConfig } from '../schema/packaged-build-config';

export interface BundleInfo {
  entryFile: string;
  sourceMap: boolean;
  destRoot: string;
  srcRoot: string;
  dest: {
    esm2015?: string;
    esm5?: string;
    umd?: string;
    umdMin?: string;
  }
}
export async function createBundleInfo(destRoot: string, buildConfig: PackagedBuildConfig): Promise<BundleInfo> {
  const realEntryFile = Path.resolve(destRoot, buildConfig.entry);
  // the flat metadata file is saved, per angular/compiler-cli logic, next to the entry
  const entryFile = Path.resolve(Path.dirname(realEntryFile), buildConfig.flatModuleFileName);
  const sourceMap = buildConfig.tsConfig.compilerOptions.inlineSourceMap;

  const esm2015 = Path.join(destRoot, 'esm2015', `${buildConfig.name}.js`);
  const esm5 = Path.join(destRoot, 'esm5', `${buildConfig.name}.es5.js`);
  const umd = Path.join(destRoot, 'bundles', `${buildConfig.name}.umd.js`);
  const umdMin = Path.join(destRoot, 'bundles', `${buildConfig.name}.umd.min.js`);

  return Promise.resolve({
    entryFile,
    sourceMap,
    destRoot,
    srcRoot: Path.resolve(buildConfig.metaDir, buildConfig.src),
    dest: {
      esm2015,
      esm5,
      umd,
      umdMin
    }
  });
}
