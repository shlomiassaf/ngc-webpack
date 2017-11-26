import * as Path from 'path';

import { loadConfigFile } from '../../cli/config-file';
import { PackagedBuildConfig, PackagedLibraryBuildMeta } from './packaged-build-config';

/**
 * Load's and init's build configuration from a file or a directory.
 */
export function loadFromFile(filePath: string): PackagedBuildConfig[] {
  const { fileName, config } = loadConfigFile(filePath);
  return load(Path.dirname(fileName), config.ngLibrary);
}

/**
 * Load's and init's build configuration from a library metadata object and a base directory that all relative file
 * references within the configuration a relative to.
 *
 * A base directory is required to remap all relative paths defined in the metadata to the tsconfig.
 */
export function load(baseDir: string, libraryBuildMeta: PackagedLibraryBuildMeta | PackagedLibraryBuildMeta[]): PackagedBuildConfig[] {
  const configurations = Array.isArray(libraryBuildMeta)
    ? libraryBuildMeta
    : [ libraryBuildMeta ]
  ;
  return configurations.map( ngLibrary => PackagedBuildConfig.create(baseDir, ngLibrary));
}