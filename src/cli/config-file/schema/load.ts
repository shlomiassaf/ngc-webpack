import * as Path from 'path';
import * as FS from 'fs';
import { BuildConfig, LibraryBuildMeta } from './build-config';

const DEFAULT_FILENAMES = ['ngc-webpack.json', 'package.json'];

function tryGetDefaultFile(dir: string): string | undefined {
  for (let name of DEFAULT_FILENAMES) {
    if (FS.existsSync(Path.resolve(dir, name))) {
      return Path.resolve(dir, name);
    }
  }
}

/**
 * Load's a configuration file from a directory or a specific file.
 * returns the filename and the parsed object.
 *
 * If a directory is set it will look for `package.json` or `ngc-webpack.json` files.
 * @param {string} fileOrDirPath
 * @returns {any}
 */
export function loadConfigFile(fileOrDirPath: string) {
  const stats = FS.statSync(fileOrDirPath);

  if (stats.isDirectory()) {
    const fromDefault = tryGetDefaultFile(fileOrDirPath);
    if (!fromDefault) {
      throw new Error(`Unable to locate default ngc-webpack config file in directory "${fileOrDirPath}"`);
    }
    fileOrDirPath = fromDefault;
  } else if (!FS.existsSync(fileOrDirPath)) {
    throw new Error(`Unable to locate ngc-webpack config file "${fileOrDirPath}"`);
  }

  return {
    fileName: fileOrDirPath,
    config: JSON.parse(FS.readFileSync(fileOrDirPath, { encoding: 'utf-8' }))
  };
}

/**
 * Load's and init's build configuration from a file or a directory.
 */
export function loadFromFile(filePath: string): BuildConfig[] {
  const { fileName, config } = loadConfigFile(filePath);
  return load(Path.dirname(fileName), config.ngLibrary);
}

/**
 * Load's and init's build configuration from a library metadata object and a base directory that all relative file
 * references within the configuration a relative to.
 *
 * A base directory is required to remap all relative paths defined in the metadata to the tsconfig.
 */
export function load(baseDir: string,
                     libraryBuildMeta: LibraryBuildMeta | LibraryBuildMeta[]): BuildConfig[] {
  const configurations = Array.isArray(libraryBuildMeta)
    ? libraryBuildMeta
    : [ libraryBuildMeta ]
  ;
  return configurations.map( ngLibrary => BuildConfig.create(baseDir, ngLibrary));
}