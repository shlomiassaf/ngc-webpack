[![Build Status](https://travis-ci.org/shlomiassaf/ngc-webpack.svg?branch=master)](https://travis-ci.org/shlomiassaf/ngc-webpack)

### Version 3.1 - AOT Cleanup loader support
Added **AOT cleanup loader** (read below)

Added **AOT cleanup transformer** (Do not use)

### Version 3.0 - BREAKING CHANGE
Version 3.0.0 does not contain API breaking changes but does contain a logical
breaking change that might affect some setups.

The only change concerns automatically registering **ts-node**

Up to 2.0.0 **ngc-webpack** automatically loaded **ts-node**:
```js
require('ts-node/register');
```

This is ok when running **ngc-webpack** from the CLI.
However, when using the **ngc-webpack programmatically it might cause
unexpected errors, for example if one wants to invoke a custom ts-node registration.

From **ngc-webpack@3.0.0** using **ngc-webpack** from your code you need
to register ts-node manually.

> Most setups will run **ngc-webpack** using the webpack plugin, which is
running it from code (and not from CLI) but Webpack (and ts loaders)
should automatically register ts-node so the impact should be minimal.


# ngc-webpack
`@angular/compiler-cli` Wrapper for Webpack

Key features:  
  - Angular AOT compilation webpack plugin outside of the `angular-cli` eco-system      
  - Pass resources through webpack's loader chain (template, styles, etc...)  
  - Hooks into the AOT compilation process (replaces source files, metadata files, resource files)  
  - Not restricted to a TypeScript loader, use any TS loader you want  
  - Does not contain an `@angular/router` lazy module loader (you can use [ng-router-loader](https://github.com/shlomiassaf/ng-router-loader))


**ngc-webpack** is quite similar to [@ngtools/webpack](https://github.com/angular/angular-cli/tree/master/packages/%40ngtools/webpack).  
It does not do any actual compilation, this is done by angular tools. It just allows some 
customization to the process.

> `ngc-webpack` is built of some constructs from `@ngtools/webpack`.


## Usage
To install `npm install -g ngc-webpack`

There are 2 approaches to running the ngc-w:

### Build steps
Run `ngc-webpack` first, when done run webpack.
Use a AOT dedicated entry point to point to that file, from there on all references are fine.

> `ngc-webpack` does not care about SCSS, LESS or any intermediate resource that requires transformation. Each resource will follow the chain defined in the webpack configuration supplied. You get identical result in but development and prod (with AOT) builds.

**This approach does not require using the plugin but its limits your control over the bundle.**

```shell
ngc-w -p tsconfig.json --webpack webpack.aot.json
```

`ngc-webpack` wraps `compiler-cli` so all cli parameters sent to `ngc` are valid here (e.g: -p for ts configuration file).  
The only additional parameter is the `--webpack` parameter used to point to the webpack configuration factory.

### AOT Cleanup loader

The AOT cleanup loader is a an optional loader to be added to webpack that will remove angular decorators from the TypeScript source code.

As the name suggests, the loader should run **only** when compiling AOT, if you run it when the target is JIT the application will fail to run.

The **AOT cleanup loader** removes all angular decorators (e.g.  `NgModel`, `Component`, `Inject` etc...) from TypeScript code before the main TS loader kicks in (`ts-loader`, `awesome-typescript-loader`, etc...).
The decorators are not needed in AOT mode since the AOT compiler converts the metadata in them into code and saves it in `ngfactory.ts` files.

It is always recommended to run the **AOT cleanup loader** for AOT production build as it will:

  1. Reduces the bundle size
  2. Speeds up initial bootstrap time and any future `NgModule` lazy loading

The impact volume depends on the application size.
Bigger application = more decorators = more effect.

> Speed up in initial bootstrap is not significant and unnoticeable in most cases.

#### Loader options:
```ts
export interface AotCleanupLoaderOptions {
  /**
   * If false the plugin is a ghost, it will not perform any action.
   * This property can be used to trigger AOT on/off depending on your build target (prod, staging etc...)
   *
   * The state can not change after initializing the plugin.
   * @default true
   */
  disable?: false;

  /**
   * A path to a TSConfig file, optional if a plugin is supplied.
   * When both are available `tsConfigPath` wins.
   */
  tsConfigPath?: any;

  /**
   * Optional TS compiler options.
   *
   * > Some options set by the loader can not change.
   */
  compilerOptions?: any;
}
```

#### Loader VS TypeScript transformers
The **AOT cleanup loader** is a temporary solution to solve the cleanup problem. It is not the optimal one.

The optimal solution is to use the `Transformers API` in **TypeScript**.
The API is not complete nor stable which is why the loader approach is used.
**ngc-webpack** library has a transformer implementation ready and exposed but not documented yet since it will fail on certain use cases due to bugs in the transformers API.

#### Webpack config example:
```
{
  test: /\.ts$/,
  use: [
    {
      loader: 'awesome-typescript-loader',
      options: {
        configFileName: 'tsconfig.webpack.json',
      }
    },
    {
      loader: 'ngc-webpack',
      options: {
        disable: false,                   // SET TO TRUE ON NON AOT PROD BUILDS
      }
    },
    {
      loader: 'angular2-template-loader'
    }
  ]
}

// This setup assumes NgcWebpackPlugin is set in the plugins array.
```

#### Real time loader analysis

The following table displays an analysis of the bundling process with
and without the loader. The source is an Angular application (v 4.3.1)
with a total **177** angular decorators spread across 140,527 TypeScript lines
of code (42,796 net total of actual source LOC).

This a small to medium size application.

> Note that 177 decorators means a combination of all angular decorators, some emit more boilerplate then others (e.g. `@Component` vs `@Injectable`)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Non Minified**&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Minified (UglifyJS)**

|                | Webpack compile time (sec) | Final Bundle Size (kb) |   | Webpack compile time (sec) | Final Bundle Size (kb) |
|----------------|:--------------------------:|:----------------------:|:-:|:--------------------------:|:----------------------:|
|   With Loader  |                        115 |                   1721 |   |                        138 |                    467 |
| Without Loader |                        118 |                   1848 |   |                        143 |                    491 |
|      Diff      |                          **3** |                    **127** |   |                          **5** |                     **24** |


> Running **without the loader** was done using the `resourceOverride` feature of **ngc-webpack** plugin. It means that the resources are not present in both cases and does not effect the result.

##### Bundle Size
The bundle size is also reduces, around 7% for non minified and 5% for minified.
This is substantial and will increase over time.


> Initial bootstrap improvement was not measured, I don't think it is
noticeable.


##### Time
Time is not that interesting as bundle size since it's not effecting the
user but the results surprised me so I dag in.

We can see a small decrease of webpack runtime.
While we add an extra loader that does TS processing we reduce the
payload for following loaders and plugins. Decorators emit boilerplate
that they won't need to process.
The additional processing we add is less then we remove. It get stronger
When using UglifyJS, again, it has less data to minify.


##### Memory footprint (webpack)
The loader use's it's own TS compilation process, this is an additional
process that consumes memory. The compilation example ran with
`--max_old_space_size=4096`.

> Using `resourceOverride` plugin option has no effect when using the loader.

### Plugin
`ngc-webpack` comes with an optional plugin called `NgcWebpackPlugin`  
The plugin allows hooking into the resource compilation process.

```ts
export interface NgcWebpackPluginOptions {
  /**
   * If false the plugin is a ghost, it will not perform any action.
   * This property can be used to trigger AOT on/off depending on your build target (prod, staging etc...)
   *
   * The state can not change after initializing the plugin.
   * @default true
   */
  disabled?: boolean;

  /**
   * A hook that invokes before the `compiler-cli` start the compilation process.
   * (loader: { get(filename: string): Promise<string> }) => Promise<void>;
   * 
   * The hook accepts an object with a `get` method that acts as a webpack compilation, being able to compile a file and return it's content.
   * @param loader
   */
  beforeRun?: BeforeRunHandler

  /**
   * Transform a source file (ts, js, metadata.json, summery.json)
   * (path: string, source: string) => string;
   * 
   * Note that source code transformation is sync, you can't return a promise (contrary to `resourcePathTransformer`).  
   * This means that you can not use webpack compilation (or any other async process) to alter source code context.  
   * If you know the files you need to transform, use the `beforeRun` hook.
   */
  readFileTransformer?: ReadFileTransformer;

  
  /**
   * Transform the path of a resource (html, css, etc)
   * (path: string) => string;
   */
  resourcePathTransformer?: ResourcePathTransformer;
  
  /**
   * Transform a resource (html, css etc)
   * (path: string, source: string) => string | Promise<string>;
   */
  resourceTransformer?: ResourceTransformer;
  
  /**
   * Fires then the compilation ended with no errors.
   * () => void;
   * 
   * > If you throw from the callback the process will exit with failure and print the error message.
   * This allows some validation for `resourcePathTransformer`, to check the state one finished and conclude about the result.
   */
  
  onCompilationSuccess?: OnCompilationSuccess;
  /**
   * Fires then the compilation ended with an error.
   * (err: Error) => void;
   * 
   * > If you throw from the callback the process will exit with failure and print the error message.
   * This allows some validation for `resourcePathTransformer`, to check the state one finished and conclude about the result.
   *   
   * > Throwing from `onCompilationError` is like re-throw with a new error.
   * Currently it's not possible to suppress an error.
   */
  onCompilationError?: OnCompilationError;

  /**
   * A path to a tsconfig file, if set the AOT compilation is triggered from the plugin.
   * When setting a tsconfig you do not need to run the compiler from the command line.
   * 
   * If you are not setting a config file the compilation will not run and you need to run it before webpack starts.
   * When AOT compiling outside of the plugin (i.e. no tsconfig property), you can still use the 
   * plugin to access the hooks, but remember that the hooks will run from the command line process (e.g: `ngc-w`) 
   * @default undefined
   */
  tsConfig?: string;

  /**
   * A path to a file (resource) that will replace all resource referenced in @Components.
   * For each `@Component` the AOT compiler compiles it creates new representation for the templates (html, styles)
   * of that `@Components`. It means that there is no need for the source templates, they take a lot of
   * space and they will be replaced by the content of this resource.
   *
   * To leave the template as is set to a falsy value (the default).
   *
   * TIP: Use an empty file as an overriding resource. It is recommended to use a ".js" file which
   * usually has small amount of loaders hence less performance impact.
   *
   * > This feature is doing NormalModuleReplacementPlugin for AOT compiled resources.
   * 
   * ### resourceOverride and assets
   * If you reference assets in your styles/html that are not inlined and you expect a loader (e.g. url-loader)
   * to copy them, don't use the `resourceOverride` feature as it does not support this feature at the moment.
   * With `resourceOverride` the end result is that webpack will replace the asset with an href to the public
   * assets folder but it will not copy the files. This happens because the replacement is done in the AOT compilation
   * phase but in the bundling it won't happen (it's being replaced with and empty file...)
   * 
   * @default undefined
   */
  resourceOverride?: string;

  /**
   * Angular compiler CLI options
   */
  cliOptions?: any;
}
```

## Background
The angular compiler generate additional JS runtime files that are part of the final bundle,
these files reflect the `@Component` resources (html, css) as JS executable code.

When compiling AOT we need to add them to the final bundle.
> When compiling JIT these files are added to the VM on runtime, but that's not relevant for our context.

The angular compiler performs static analysis on our app, thus it needs to run before **webpack** (it needs the TS files).
This process create 2 problems:

  - The generated files are not referenced in our app (webpack won't bundle them)

  - The `Compiler` compiles resources such as HTML, CSS, SCSS...
 In a webpack environment we expect these resources to pass through the loader chain **BEFORE** they are process by the angular `Compiler`.
 This is the case when we develop using JIT.

`@ngtools/webpack` is the tools used by the `angular-cli`.

## What does ngc-webpack do?
`ngc-webpack` integrates with webpack to run `@Component` resources such as HTML, CSS, SCSS etc through
the webpack loader chain. e.g. usually you will need to do some pre/post processing to your styles...

If you use `ngc-webpack` through the plugin you can also fine tune the bundling process, this can help with
reducing the bundle size, keep reading to get more information (resourceOverride).

### Build steps
Run the `compiler-cli` to generate files.
Use a AOT dedicated entry point to point to that file, from there on all references are fine.

This approach requires you to have 1 extra file, no big deal.

The problem with this approach is the resources, `compiler-cli` runs before webpack so it gets raw files, e.g A SCSS file is passes as is.

`ngc-webpack` solves this by running each of the resources through webpack using the webpack configuration file supplied.

> `ngc-webpack` does not care about SCSS, LESS or any intermediate resource that requires transformation. Each resource will follow the chain defined in the webpack configuration supplied. You get identical result in but development and prod (with AOT) builds.

## Why?
Initially, `ngc-webpack` was built to cover the gap between "vanilla" webpack driven angular applications 
and `angular-cli` application. There was no tool to handle that and production builds for angular application 
was impossible unless using the cli. `ngc-webpack` covered that gap.

Nowdays, the `angular-cli` is pretty mature, especially with the webpack export capability. 
If you have a simple build process I suggest you use the CLI, in fact I suggest you use the 
CLI by default and only if you face a scenario that **ngc-webpack** can solve, use it. 

## My use-case
In the company I work for, the build process requires some modification to 3rd-party libraries.  
This modification involves recompiling SCSS files and other funky stuff. Using **ngc-webpack** 
we are able to change `ComponentMetadata#styles` of already AOT compiled angular components.  
 
## Blog post:
If time allows, I will write a blog post on how we completely restyled the `@angular/material` 
library by compiling our versions of material components SCSS files and replacing them with the, already compiled, styles.  
