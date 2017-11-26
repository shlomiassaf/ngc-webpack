import * as resolve from 'resolve';

const libs = [
  'fs-extra',
  'sorcery',
  'rollup',
  'rollup-plugin-node-resolve',
  'uglify-js',
  'zlib'
];

export function validate(): Array<[string, Error]> {
  
  const errors: Array<[string, Error]> = [];
  
  for (let lib of libs) {
    try {
     resolve.sync(lib, { basedir: process.cwd() });
    } catch (err) {
      errors.push([lib, err]);
    }
  }

  return errors;
}