import { predefinedExternals } from './predefined-externals';
import { BuildConfig, LibraryBuildMeta } from '../../cli';

const DEFAULT_PREDEFINED_EXTERNAL_KEYS = ['@angular', '@angular/cdk', '@angular/material', 'rxjs'];

/** Method that converts dash-case strings to a camel-based string. */
export const dashCaseToCamelCase =
  (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

export interface PackagedLibraryBuildMeta extends LibraryBuildMeta {
  /**
   * A list of features to disable.
   * By default, all features are enabled.
   * List the features you want to disable and set them to true
   */
  disableFeatures?: {
    es2015?: true;
    es5?: true;
    umd?: true;
    umdMinify?: true;
    umdGzip?: true;
  },

  /**
   * The global name of the library when imported by other libraries.
   *
   * This value applies to bundles libraries (FESM, FESM-ES5, UMD)
   *
   * If not set, the default is a transformation of the raw 'name' property in pacakge.json.
   * The transformation will create a valid global name where all dash-case literals will transform to camel case and
   * deep imports in name are separated by a dot (".") instead of "/".
   * Examples:
   *  - react: react
   *  - @angular/core: angular.core
   *  - @angular/core/testing: angular.core.testing
   *  - @angular/platform-browser: angular.platformBrowser
   *
   * The transformation is straight forward, if you want a different behaviour you will need to set the umd manually.
   * > All angular packages are ng.XXX (e.g. @angular/core => ng.core), this is just for demonstration
   */
  moduleName?: string;

  /**
   * A object map that represents a collection of key value pairs where each key is a module ID and the value
   * is the global name for the module.
   *
   * If a module ID has no global name set the value to false.
   */
  externals?: { [ name: string ]: string | false };


  /**
   * A list of keys representing predefined externals.
   *
   * Available sets:
   *  - @angular : all angular packages (core, common, http, forms, router etc...)
   *  - @angular/cdk: all angular cdk packages
   *  - @angular/material: all angular material packages
   *  - rxjs: all rxjs modules
   *
   * If not set all predefined externals are used, otherwise only the specified sets are used.
   */
  predefinedExternals?: Array<'@angular' | '@angular/cdk' | '@angular/material' | 'rxjs'>;

  secondary?: PackagedLibraryBuildMeta[];
}


export class PackagedBuildConfig extends BuildConfig {

  disableFeatures: {
    es2015?: true;
    es5?: true;
    umd?: true;
    umdMinify?: true;
    umdGzip?: true;
  };

  moduleName: string;
  externals: { [ name: string ]: string | false };

  /**
   * The parent of a secondary build config, valid only for secondary instances.
   */
  parent?: PackagedBuildConfig;
  secondary?: PackagedBuildConfig[];

  private validateDisabledFeatures() {
    const f = this.disableFeatures;
    if (f.es2015 && f.es5 && f.umd) {
      throw new Error('All bundling option features are disabled.');
    }
  }

  static create(rawPath: string, raw: PackagedLibraryBuildMeta, buildConfig?: PackagedBuildConfig): PackagedBuildConfig  {
    if (!buildConfig) {
      buildConfig = new PackagedBuildConfig();
    }

    BuildConfig.create(rawPath, raw, buildConfig);

    if (raw.disableFeatures) {
      buildConfig.disableFeatures = raw.disableFeatures;
      buildConfig.validateDisabledFeatures();
    } else {
      buildConfig.disableFeatures = {};
    }


    if (raw.moduleName) {
      buildConfig.moduleName = raw.moduleName;
    } else {
      buildConfig.moduleName = buildConfig.rawName.split('/').map(k => dashCaseToCamelCase(k) ).join('.');
      if (buildConfig.moduleName[0] === '@') {
        buildConfig.moduleName = buildConfig.moduleName.substr(1);
      }
    }

    const predefinedExternalsKeys = Array.isArray(raw.predefinedExternals)
      ? raw.predefinedExternals
      : DEFAULT_PREDEFINED_EXTERNAL_KEYS
    ;

    buildConfig.externals = {};
    if (predefinedExternalsKeys) {
      predefinedExternalsKeys.forEach( key => {
        if (predefinedExternals.hasOwnProperty(key)) {
          Object.assign(buildConfig.externals, predefinedExternals[key]);
        } else {
          console.warn(`Predefine external key "${key}" is unknown or invalid.`);
        }
      });
    }
    if (raw.externals) {
      Object.assign(buildConfig.externals, raw.externals);
    }

    if (raw.secondary) {
      buildConfig.secondary = raw.secondary.map( s => {
        const secondary = new PackagedBuildConfig();
        secondary.parent = buildConfig;
        secondary.pkgJson = {
          name: `${buildConfig.pkgJson.name}/${s.name}`
        };

        const secondaryRaw = Object.assign({}, raw, s, {secondary: []});
        return PackagedBuildConfig.create(rawPath, secondaryRaw, secondary);
      })
    }

    return buildConfig;
  }
}
