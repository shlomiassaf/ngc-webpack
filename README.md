[![Build Status](https://travis-ci.org/shlomiassaf/ngc-webpack.svg?branch=master)](https://travis-ci.org/shlomiassaf/ngc-webpack)

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
