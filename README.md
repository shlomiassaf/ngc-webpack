[![Build Status](https://travis-ci.org/shlomiassaf/ngc-webpack.svg?branch=master)](https://travis-ci.org/shlomiassaf/ngc-webpack)

# Angular Template Compiler Wrapper for Webpack

**compiler-cli** with webpack's loader chain.

> Note: Version 1.1.0 allows using the plugin to manage angular compilation without the
need to run the compilation command from the command line before webpack is executed.
It also allows removing `@Component` templates (template/styles) from the bundle since they 
become not used duplicates after AOT compilation.  
This will be documented soon, meanwhile see the `AngularClass/angular2-webpack-starter` repo for an example.


A wrapper around the [compiler-cli](https://github.com/angular/angular/tree/master/modules/%40angular/compiler-cli)
that pass `@Component` resources (*templateUrl, styleUrls*) through webpack's build loader chain.  


Currently apply the loader chain only on `@Component` resources.

> `ngc-webpack` is built of some constructs from `@ngtools/webpack`.

## Background
The angular compiler generate additional JS runtime files that are part of the final bundle, these files reflect the `@Component` resources (html, css) as JS executable code.

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

  pathTransformer?: PathTransformer;
  sourceTransformer?: SourceTransformer;
  onCompilationSuccess?: OnCompilationSuccess;
  onCompilationError?: OnCompilationError;

  /**
   * A path to a tsconfig file, if set the AOT compilation is triggered from the plugin.
   * When setting a tsconfig you do not need to run the compiler from the command line.
   *
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
   * @default undefined
   */
  resourceOverride?: string;

  /**
   * Angular compiler CLI options
   */
  cliOptions?: any;
}
```

###tsConfig
Path to a tsconfig file, if set the AOT compilation is triggered from the plugin.
When setting a tsconfig you do not need to run the compiler from the command line.  
If you are not setting a config file the compilation will not run and you need to run it before webpack starts.  
Whe not compiling using the plugin, use the plugin to access the hooks, but remember that the hooks will run from
 the command line process (e.g: `ngc-w`)

### resourceOverride
AOT converts all `@Component` templates (html/styles) into runtime code, these are **additional** files 
added to the bundle.  
When webpack bundles the application it adds these new files to the bundle but still see's the reference  
to the source templates that still exists in the `@Component` declaration.  
The end result is a redundant copy of the templates.
Use this option to replace the templates with an empty content, this will reduce the bundle significantly.

### resourceOverride and assets
If you reference assets in your styles/html that are not inlined and you expect a loader (e.g. url-loader) 
to copy them, don't use the `resourceOverride` feature as it does not support this feature at the moment.

With `resourceOverride` the end result is that webpack will replace the asset with an href to the public
assets folder but it will not copy the files. This happens because the replacement is done in the AOT compilation
phase but in the bundling it won't happen (it's being replaced with and empty file...)

###pathTransformer
A Hook that allows changing a given template (html/styles) path.
The `pathTransformer` hooks is a callback that get's a path (string) and return a path (different to same).  
If the returned path is an empty string ('') the content of the resource is ignored and will resolve to an empty string.

###sourceTransformer
A Hook that allows changing a given template (html/styles) content.
The `sourceTransformer` hooks is a callback that get's the content (string) and return content (different to same, can also return Promise<string>).  


In addition there are 2 callbacks invoked when the process ends:  
  - **onCompilationSuccess: () => void**  
  Fires then the compilation ended with no errors.
  - **onCompilationError?: (error: Error) => void**  
  Fires then the compilation ended with an error.
  
If you throw from these callbacks the process will exit with failure and print the error message.
This allows some validation for `pathTransformer`, to check the state one finished and conclude about the result.

> Throwing from `onCompilationError` is like re-throw with a new error.  
Currently it's not possible to suppress an error.

Example (webpack.config module)
```js
const NgcWebpack = require('ngc-webpack');

module.exports = function () {
  return {
    /* All webpack configuration stuff... */
    plugins: [
      /* Webpack plugins here... */
      new NgcWebpack.NgcWebpackPlugin({
        pathTransformer: function(resourcePath) {
          /*
              If we compile a material button, remove it style.
           */
          const MAT_BUTTON_RE = /(^.*\/node_modules\/@angular\/material\/button\/button\.css$)/;
          if (MAT_BUTTON_RE.test(resourcePath)) {
            return '';
          }
          return resourcePath;
        }
      })
    ]
  }
}
```

## Why
In the future I hope we all converge into 1 solution, `@ngtools/webpack`, if you have no issues with it, you don't need `ngc-webpack`.

However, `@ngtools/webpack` use it's own `ts` loader and controls the whole TS compilation process.  
It's also a closed solution, you can't hook into it.

if this is an issue for you, use `ngc-webpack`.

> NOTE: I strongly suggest trying to use `@ngtools/webpack` if it works for you stay with it.  
My bet is that it will be the de-facto tool for AOT with webpack.
