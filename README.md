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


## Usage
To install `npm install -g ngc-webpack`

Compiling:
```
ngc-w --webpack webpack.aot.json
```

`ngc-webpack` wraps `compiler-cli` so all cli parameters sent to `ngc` are valid here (e.g: -p for ts configuration file).  
The only additional parameter is the `--webpack` parameter used to point to the webpack configuration factory.


## Why
In the future I hope we all converge into 1 solution, `@ngtools/webpack`, if you have no issues with it, you don't need `ngc-wrapper`.

However, `@ngtools/webpack` use it's own `ts` loader and controls the whole TS compilation process.  
It's also a closed solution, you can't hook into it.

if this is an issue for you, use `ngc-webpack`.

> NOTE: I strongly suggest trying to use `@ngtools/webpack` if it works for you stay with it.  
My bet is that it will be the de-facto tool for AOT with webpack.