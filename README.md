# Angular Template Compiler Wrapper for Webpack

**compiler-cli** with webpack's loader chain.

A wrapper around the [compiler-cli](https://github.com/angular/angular/tree/master/modules/%40angular/compiler-cli)
that pass `@Component` resources (*templateUrl, styleUrls*) through webpack's build loader chain.  

A solution for webpack bundling using build steps (not `@ngtools/webpack`).

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
  


Currently, there are 2 approaches to solve problems above: 

  1. Continuous integration (just made up that name)
  2. Build steps
  
### Continuous
Implemented by [@ngtools/webpack](https://github.com/angular/angular-cli/tree/master/packages/%40ngtools/webpack).  
This approach integrates into **webpack** using loaders and plugins to push new dependencies into the
webpack dependency tree while compiling and also pass the resources through the loaders chain.

The end result is a seamless AOT compilation process, part of the webpack process.

`@ngtools/webpack` is the tools used by the `angular-cli`.

### Build steps
Run the `compiler-cli` to generate files.
Use a AOT dedicated entry point to point to that file, from there on all references are fine.

This approach requires you to have 1 extra file, no big deal.

The problem with this approach is the resources, `compiler-cli` runs before webpack so it gets raw files, e.g A SCSS file is passes as is.

`ngc-webpack` solves this by running each of the resources through webpack using the webpack configuration file supplied.

> `ngc-webpack` does not care about SCSS, LESS or any intermediate resource that requires transformation. Each resource will follow the chain defined in the webpack configuration supplied. You get identical result in but development and prod (with AOT) builds.

## Usage
To install `npm install -g ngc-webpack`

Compiling:
```
ngc-w --webpack webpack.aot.json
```

`ngc-webpack` wraps `compiler-cli` so all cli parameters sent to `ngc` are valid here (e.g: -p for ts configuration file).  
The only additional parameter is the `--webpack` parameter used to point to the webpack configuration factory.

### Plugin
`ngc-webpack` comes with an optional plugin called `NgcWebpackPlugin`  
The plugin allows hooking into the resource compilation process.

Currently, the only feature is path transformation, i.e: given a path to a resource, return a different path.
The `pathTransformer` hooks is a callback that get's a path (string) and return a path (different to same).  
If the returned path is an empty string ('') the content of the resource is ignored and will resolve to an empty string.

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
In the future I hope we all converge into 1 solution, `@ngtools/webpack`, if you have no issues with it, you don't need `ngc-wrapper`.

However, `@ngtools/webpack` use it's own `ts` loader and controls the whole TS compilation process.  
It's also a closed solution, you can't hook into it.

if this is an issue for you, use `ngc-webpack`.

> NOTE: I strongly suggest trying to use `@ngtools/webpack` if it works for you stay with it.  
My bet is that it will be the de-facto tool for AOT with webpack.
