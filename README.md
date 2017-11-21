[![Build Status](https://travis-ci.org/shlomiassaf/ngc-webpack.svg?branch=master)](https://travis-ci.org/shlomiassaf/ngc-webpack)

# ngc-webpack
[@ngtools/webpack](https://github.com/angular/angular-cli/tree/master/packages/%40ngtools/webpack) wrapper with hooks into
the compilation process and library mode compilation support.

 - [Background](#background)
 - [Porting to/from `@ngtools/webpack](#porting)
 - [Usage](#usage)
   - [Advanced AOT production builds](#advanced-aot-production-builds)
   - [Options](#ngcwebpackpluginoptions)
 - [Optional Patching](#optional-patching)

# Library mode:
Library mode is the simple **compile** process we know from `tsc` / `ngc`
where each module (`TS` file) is compiled into a matching `JS` file.

The output files are then bundled with RollUp to create various bundle
formats for published libraries (FESM, FESM2015, UMD, etc.)

This process is fairly simple as is but with the angular AOT compiler
in the middle things are a bit more complex.

`@ngtools/webpack` does not support library compilation and it is (1.8.x)
design for application bundling only.

The `@angular/compiler-cli` does support library compilation through its
`ngc` command line utility but it does not know about webpack,
resources will not go through the loader chain and so using formats not
supported by the angular cli will not work (SCSS, LESS etc).

Additionally, `templareUrl` and `stylesUrls` are left as is which is not
suitable for libraries, resources must get inlined into the sources code (JS)
and the AOT generated `metadata.json` files.

### Webpack based projects:
`ngc-webpack` library mode allows AOT compilation for libraries through
a CLI interface (`ngc-w`) or directly using it via node API with
full support for inline and complete webpack loader chain compilation (for resources).

### Angular CLI based projects:
`ngc-webpack` also support library compilation for `@angular/cli` projects
by importing the configuration from the cli and using it to build libraries.
This works great with monorepos and setup's based on [nrwl's `Nx`](https://github.com/nrwl/nx).
Also available by CLI interface (`ngc-w-cli`) or node API.


For more information see:
 - [Library compilation mode](#LIBRARY_MODE.md)


## Background:
`ngc-webpack` started as a wrapper for `@angular/compiler-cli` when angular
build tools were limited.

It offered non `@angular/cli` users the ability to perform an AOT builds
with all the required operations while still using a dedicated typescript
loader (e.g. `ts-loader`, `awesome-typescript-loader`).

With version 5 of angular, the `compiler-cli` introduces a dramatic
refactor in the compilation process, enabling watch mode for AOT and
moving to a (almost) native TS compilation process using transformers.

The support angular 5, a complete rewrite for `ngc-webpack` was required.
Since `@ngtools/webpack` is now a mature plugin with a rich feature set
and core team support it is not smart (IMHO) to try and re-implement it.

This is why, from version 4 of `ngc-webpack`, the library will wrap
`@ngtools/webpack` and only provide hooks into the compilation process.

The implications are:
  - Using `ngc-webpack` is safe, at any point you can move to `@ngtools/webpack`.
  - All features of `@ngtools/webpack` will work since `ngc-webpack` acts as a proxy.
    This includes i18n support which was not included in `ngc-webpack` 3.x.x
  - You can hack your way into the AOT compilation process, which opens
    a lot of options, especially for library compilation.
  - Using a custom typescript loader is no longer supported, you need to
    use the loader provided with `@ngtools/webpack` (for JIT see Using custom TypeScript loaders)

## <a name="porting">Porting to/from `@ngtools/webpack
Using `ngc-webpack` as a proxy to `@ngtools/webpack` is safe and allows
quick and transparent porting between the libraries.

In fact, if you use `ngc-webpack` without using it's extensibility
features you probably better of using `@ngtools/webpack` directly instead.

When using `ngc-webpack` features, including library compilation mode,
you should be aware that `ngc-webpack` is using experimental angular APIs
as well as internal implementation of angular code to allow extensibility.

## Usage:
```bash
npm install ngc-webpack -D
```

**webpack.config.js**
```js
{
    module: {
        rules: [
            {
                test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
                use: [ '@ngtools/webpack' ]
            }
        ]
    },
    plugins: [
        new ngcWebpack.NgcWebpackPlugin({
          AOT: true,                            // alias for skipCodeGeneration: false
          tsConfigPath: './tsconfig.json',
          mainPath: 'src/main.ts'               // will auto-detect the root NgModule.
        })
    ]
}
```

### Advanced AOT production builds:
Production builds must be AOT compiled, this is clear, but we can optimize
the build even further, and the angular team has us covered using
`'@angular-devkit/build-optimizer`:

**webpack.config.js**
```js
const PurifyPlugin = require('@angular-devkit/build-optimizer').PurifyPlugin;

const AOT = true;

const tsLoader = {
    test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
    use: [ '@ngtools/webpack' ]
};

if (AOT) {
    tsLoader.use.unshift({
        loader: '@angular-devkit/build-optimizer/webpack-loader',
        // options: { sourceMap: true }
    });
}

return {
    module: {
        rules: [
            tsLoader
        ]
    },
    plugins: [
        new ngcWebpack.NgcWebpackPlugin({
          AOT,                            // alias for skipCodeGeneration: false
          tsConfigPath: './tsconfig.json',
          mainPath: 'src/main.ts'               // will auto-detect the root NgModule.
        }).concat(AOT ? [ new PurifyPlugin() ] : []),
    ]
}
```

> The examples above are super simplified and describe the basic units
for compilation, the `@angular/cli` uses them but with a lot more loaders/plugins/logic.

For more information about setting up the plugin see [@ngtools/webpack](https://github.com/angular/angular-cli/tree/master/packages/%40ngtools/webpack)

### NgcWebpackPluginOptions:
The plugin accepts an options object of type `NgcWebpackPluginOptions`.

`NgcWebpackPluginOptions` extends [AngularCompilerPluginOptions](https://github.com/angular/angular-cli/blob/master/packages/%40ngtools/webpack/src/plugin.ts) so
all `@ngtools/webpack` options apply.

`NgcWebpackPluginOptions` adds the following options:
```ts
export interface NgcWebpackPluginOptions extends AngularCompilerPluginOptions {

  /**
   * An alias for `AngularCompilerPluginOptions.skipCodeGeneration` simply to make it more readable.
   * If `skipCodeGeneration` is set, this value is ignored.
   * If this value is not set, the default value is taken from `skipCodeGeneration`
   * (which means AOT = true)
   */
  AOT?: boolean;

  /**
   * A hook that invokes before the plugin start the compilation process (compiler 'run' event).
   * ( resourceCompiler: { get(filename: string): Promise<string> }) => Promise<void>;
   *
   * The hook accepts a resource compiler which able (using webpack) to perform compilation on
   * files using webpack's loader chain and return the final content.
   * @param resourceCompiler
   */
  beforeRun?: BeforeRunHandler

  /**
   * Transform a source file (ts, js, metadata.json, summery.json).
   * If `predicate` is true invokes `transform`
   *
   * > Run's in both AOT and JIT mode on all files, internal and external as well as resources.
   *
   *
   *  - Do not apply changes to resource files using this hook when in AOT mode, it will not commit.
   *  - Do not apply changes to resource files in watch mode.
   *
   * Note that source code transformation is sync, you can't return a promise (contrary to `resourcePathTransformer`).
   * This means that you can not use webpack compilation (or any other async process) to alter source code context.
   * If you know the files you need to transform, use the `beforeRun` hook.
   */
  readFileTransformer?: ReadFileTransformer;


  /**
   * Transform the path of a resource (html, css, etc)
   * (path: string) => string;
   *
   * > Run's in AOT mode only and on metadata resource files (templateUrl, styleUrls)
   */
  resourcePathTransformer?: ResourcePathTransformer;

  /**
   * Transform a resource (html, css etc)
   * (path: string, source: string) => string | Promise<string>;
   *
   * > Run's in AOT mode only and on metadata resource files (templateUrl, styleUrls)
   */
  resourceTransformer?: ResourceTransformer;

  /**
   * Add custom TypeScript transformers to the compilation process.
   *
   * Transformers are applied after the transforms added by `@angular/compiler-cli` and
   * `@ngtools/webpack`.
   *
   * > `after` transformers are currently not supported.
   */
  tsTransformers?: ts.CustomTransformers;
}
```

## Optional Patching:
`ngc-webpack` comes with optional patches to angular, these are workarounds
to existing issue that will probably get fixed in the future making the patch
obsolete. Patch's address specific use case so make sure you apply them only
if required.

### `disableExpressionLowering` fix (`@angular/compiler-cli`):
The `compiler-cli` (version 5.0.1) comes with a new feature called
**lowering expressions** which basically means we can now use arrow
functions in decorator metadata (usually provider metadata)

This feature has bug the will throw when setting an arrow function:
```ts
export function MyPropDecorator(value: () => any) {
  return (target: Object, key: string) => {  }
}

export class MyClass {
  @MyPropDecorator(() => 15) // <- will throw because of this
  prop: string;
}
```

The compiler will lower the expression to:
```ts
export const ɵ0 = function () { return 15; };
```

but in the TS compilation process will fail because of a TS bug.

This is an edge case which you probably don't care about, but if so
there are 2 options to workaround:

  1. Set `disableExpressionLowering` to false in `tsconfig.json` `angularCompilerOptions`
  2. Import a patch, at the top of your webpack config module:
  ```js
   require('ngc-webpack/src/patch-angular-compiler-cli');
  ```

The issue should be fixed in next versions.
See https://github.com/angular/angular/issues/20216

#### Using custom TypeScript loaders
From `ngc-webpack` 4 using a custom ts loader is not supported for AOT
compilation and partially supported for JIT.

If you must use your own TS Loader for JIT, you can do so.
This is not recommended mainly because of the mis alignment between the
compilations.

To use a custom loader (JIT only), remove the `@ngtools/webpack` loader
and set your own loader. To support lazy loaded modules, use a module
loader that can detect them (e.g. [ng-router-loader](https://github.com/shlomiassaf/ng-router-loader))

## Use case
The feature set within `ngc-webpack` is getting more and more specific.
The target audience is small as most developers will not require hooking
into the compilation.

It is mostly suitable for library builds, where you can control the
metadata output, inline code and more...

I personally use it to restyle material from the ground.
The plugin enables re-writing of the `index.metadata.json` files on
the fly which allows sending custom styles to the compiler instead of
the ones that comes with material.


## Future
Because `ngc-webpack` becomes a niche, I believe integrating the hooks
into `@ngtools/webpack` makes sense and then deprecating the library while
easy porting to `@ngtools/webpack`. If someone would like to help working
on it, please come forward :)

I believe it angular team is open to such idea since `@ngtools/webpack`
is separated from the cli.

