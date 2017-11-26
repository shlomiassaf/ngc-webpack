import * as Path from 'path';
import * as FS from 'fs-extra';

import { BundleInfo } from './bundle-info';
import { PackagedBuildConfig } from '../schema';


async function _packageJson(destRoot: string, pkgJson: any, buildInfo: BundleInfo) {
  const dest = buildInfo.dest;

  [
    ['main', 'umd'],
    ['module', 'esm5'],
    ['es2015', 'esm2015'],
  ].forEach( ([key, prop]) => {
    if ( !pkgJson.hasOwnProperty(key) &&  dest.hasOwnProperty(prop) ) {
      pkgJson[key] = Path.relative(destRoot, dest[prop]);
    }
  });

  const entryFileNoExt = Path.relative(destRoot, /^(.+)\.js$/.exec(buildInfo.entryFile)[1]);

  if ( !pkgJson.hasOwnProperty('typings') ) {
    pkgJson.typings = entryFileNoExt + '.d.ts';
  }

  if ( !pkgJson.hasOwnProperty('metadata') ) {
    pkgJson.metadata = entryFileNoExt + '.metadata.json';
  }

  await FS.writeJson(Path.join(destRoot, 'package.json'), pkgJson, { spaces: 2 } );
}

export async function mainPackageJson(buildInfo: BundleInfo) {
  const pkgJson = await FS.readJson(Path.join(buildInfo.srcRoot, 'package.json'));
  await _packageJson(buildInfo.destRoot, pkgJson, buildInfo);
}

export async function secondaryPackageJson(buildInfo: BundleInfo, buildConfig: PackagedBuildConfig) {
  const destRoot = Path.resolve(buildInfo.destRoot, buildConfig.src);
  await _packageJson(destRoot, buildConfig.pkgJson, buildInfo);
}
