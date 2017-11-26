import * as FS from 'fs';
import * as Path from 'path';
import * as ts from 'typescript';
import { TsEmitArguments } from '@angular/compiler-cli';

import { WebpackResourceLoader } from '../../resource-loader';
import { NgcParsedConfiguration } from '../config';
import { createTsickleEmitCallback, createSrcToOutPathMapper } from '../util';
import { inlineResources } from './transformers/inline-resources';
import { inlineMetadataBundle } from './inline-metadata';
import { NgcCompilerHost } from './ngc-compiler-host';

export function createCliContext(config: NgcParsedConfiguration) {
  let sourceToOutMapper: (srcFileName: string, reverse?: boolean) => string;

  const compilerHost = new NgcCompilerHost(config.options, new WebpackResourceLoader());
  const getResource = (resourcePath: string): string | undefined => compilerHost.getResource(resourcePath);
  const realEmitCallback = createTsickleEmitCallback(config.options); // defaultEmitCallback;


  const inlineMetadataModule = (fileName: string, data: string): string => {
    const metadataBundle = JSON.parse(data);

    let relativeTo = Path.dirname(fileName);
    if (sourceToOutMapper) {
      relativeTo = sourceToOutMapper(relativeTo, true);
    }

    // process the metadata bundle and inline resources
    // we send the source location as the relative folder (not the dest) so matching resource paths
    // with compilerHost will work.
    metadataBundle.forEach( m => inlineMetadataBundle(relativeTo, m, getResource) );

    return JSON.stringify(metadataBundle);
  };

  const emitCallback = (emitArgs: TsEmitArguments) => {
    const writeFile = (...args: any[]) => {
      // we don't need to collect all source files mappings, we need only 1 so it's a bit different
      // from angular's code
      if (!sourceToOutMapper) {
        const outFileName: string = args[0];
        const sourceFiles: ts.SourceFile[] = args[4];
        if (sourceFiles && sourceFiles.length == 1) {
          sourceToOutMapper = createSrcToOutPathMapper(
            config.options.outDir,
            sourceFiles[0].fileName,
            outFileName
          );
        }
      }
      return emitArgs.writeFile.apply(null, args);
    };
    return realEmitCallback(Object.create(emitArgs, { writeFile: { value: writeFile } }));
  };

  return {
    compilerHost,

    /**
     * Returns the source file to destination file mapper used to map source files to dest files.
     * The mapper is available after after the compilation is done.
     */
    getSourceToOutMapper(): ( (srcFileName: string, reverse?: boolean) => string ) | undefined {
      return sourceToOutMapper;
    },

    createCompilation(compiler) {
      const compilation = compiler.createCompilation();
      compilerHost.resourceLoader.update(compilation);
      return compilation;
    },
    getResource,
    createInlineResourcesTransformer() {
      return inlineResources(
        getResource,
        (fileName: string) => !fileName.endsWith('.ngfactory.ts') && !fileName.endsWith('.ngstyle.ts')
      )
    },
    emitCallback,

    /**
     * Returns a compilerHost instance that inline all resources (templateUrl, styleUrls) inside metadata files that was
     * created for a specific module (i.e. not a flat metadata bundle module)
     *
     */
    resourceInliningCompilerHost() {
      return Object.create(compilerHost, {
        writeFile: {
          writable: true,
          value: (fileName: string, data: string, ...args: any[]): void => {
            if (/\.metadata\.json$/.test(fileName)) {
              data = inlineMetadataModule(fileName, data);
            }
            return compilerHost.writeFile(fileName, data, args[0], args[1], args[2]);
          }
        }
      })
    },

    inlineFlatModuleMetadataBundle(relativeTo: string, flatModuleOutFile: string): void {
      let metadataPath = Path.resolve(relativeTo, flatModuleOutFile.replace(/\.js$/, '.metadata.json'));

      if (sourceToOutMapper) {
        metadataPath = sourceToOutMapper(metadataPath);
      }

      if (!FS.existsSync(metadataPath)) {
        throw new Error(`Could not find flat module "metadata.json" output at ${metadataPath}`);
      }

      const metadataBundle = JSON.parse(FS.readFileSync(metadataPath, { encoding: 'utf8' }));

      // process the metadata bundle and inline resources
      // we send the source location as the relative folder (not the dest) so matching resource paths
      // with compilerHost will work.
      inlineMetadataBundle(relativeTo, metadataBundle, getResource);

      FS.writeFileSync(metadataPath, JSON.stringify(metadataBundle), { encoding: 'utf8' });
    }
  }
}