export * from './src/plugin';
export * from './src/plugin-options';
export {
  BuildConfig,
  LibraryBuildMeta,
  createBuildTask,
  createBuildTaskFromConfigFile
} from './src/cli';

import loader from '@ngtools/webpack';
export default loader;
