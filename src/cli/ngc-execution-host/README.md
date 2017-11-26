Execution host for `@angular/compiler-cli` (ngc)

The execution host is responsible for 3 features that `ngc` does not provide:

## Async operation
While `ngc` supports async compilation it does not provide a fully
managed async compilation process.

The built-in managed compilation process is invoked by **performCompilation**
which works great but is not async.

The execution host is using a local implementation of `ngc` **performCompilation**
function, it does exactly the same operation but in an asynchronous fashion.

This is required because the webpack resource loader (and webpack loaders)
work async.

> An async process is mandatory when working with webpack, `@ngtools/webpack`
implements an async process internally and does not use **performCompilation**.


## Resource handling (HTML, CSS, SCSS, etc.)
`ngc` knows how to handle 2 resources, HTML and CSS, all other resources
will throw (SCSS, LESS, etc...).
Additionally, resources does not go through and pre/post processor.

The execution host is using a custom compiler host to pass all resources
through webpack's loader chain which means that any format is supported
as well as any pre/post processing logic that is configured.

This allows seamless AOT compilation, the current configuration you have
will kick in when building the library, same results.


## Inlining
`ngc` does not inline resources, all `templateUrl` / `styleUrls` are left
as is.

This is not suitable for library compilation so the execution host, using
custom transformers, will inline all resources in both JS files and
metadata files.