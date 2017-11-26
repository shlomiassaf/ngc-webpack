import * as Path from 'path';
import * as FS from 'fs-extra';

const uglify = require('uglify-js');
const zlib = require('zlib');

/**
 * Minify (and optionally gzip) the specified file at `fileName` and save in the specified `dstFileName`.
 * Can optionally save a sourcemap and / or gzip the result via the `options` object.
 * Each property
 * @param {string} fileName
 * @param {string} dstFileName
 * @param {Object} options - Optional instructions
 * @param {string} options.sourceMapFileName - create a source map.
 * When "true" will auto-add `.map` suffix to `dstFileName`, when "string" will use it as filename path (assumed absolute).
 * @param {string} options.gzipFileName - create a gzip from the minified result.
 * When "true" will auto-add `.gz` suffix to `dstFileName`, when "string" will use it as filename path (assumed absolute)
 */
export async function minify(fileName: string,
                             dstFileName: string,
                             options: { sourceMapFileName?: string | boolean; gzipFileName?: string | boolean; } = {}): Promise<void> {
  try {
    const unminified = await FS.readFile(fileName, { encoding: 'utf-8' });

    const minifyOptions: any = {
      parse: {
        bare_returns: true,
      },
      ie8: true,
      warnings: true,
      output: {
        comments: 'some'
      }
    };

    const sourceMapFileName: string | false = options.sourceMapFileName === true
      ? fileName + '.map'
      : options.sourceMapFileName
    ;

    if (sourceMapFileName) {
      minifyOptions.sourceMap = {
        content: await FS.readFile(sourceMapFileName, { encoding: 'utf-8' }),
        url: Path.basename(dstFileName + '.map')
      }
    }

    const minified = uglify.minify(unminified, minifyOptions);
    await FS.writeFile(dstFileName, minified.code, { encoding: 'utf-8' });
    if (sourceMapFileName && minified.map) {
      await FS.writeFile(dstFileName + '.map', minified.map, { encoding: 'utf-8' });
    }

    const gzipFileName: string | false = options.gzipFileName === true
      ? dstFileName + '.gz'
      : options.gzipFileName
    ;

    if (gzipFileName) {
      await gzip(gzipFileName, Buffer.from(minified.code))
    }

    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function gzip(destFileName: string, bufferedCode: Buffer) {
  try {
    const gzipBuffer = zlib.gzipSync(bufferedCode);

    const zipStream = FS.createWriteStream(destFileName);
    zipStream.write(gzipBuffer);
    zipStream.end();
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}