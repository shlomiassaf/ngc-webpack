Notes:

 - In most part, `ngc-webpack` is a proxy to `@ngtools/webpack`

 - Some functionality, mostly around library mode support (CLI),
 is based on angular experimental APIs.

  - In situations where angular APIs / constructs are not exposed,
  a local implementation is provided.

  - Local implementation are based on source code from the angular
  project, mostly with local modification for `ngc-webpack` logic but sometimes
  a complete copy.
  For example, the code in [cli/transformers/fw](#cli/transformers/fw) is copy
  of the transformation helper used by `@ngtools/webpack`
  The code in [inline-resources.ts](#cli/transformers/inline-resources.ts) is
  a local implementation inspired by the [replace resource transformer](https://github.com/angular/angular-cli/blob/master/packages/%40ngtools/webpack/src/transformers/replace_resources.ts) in `@ngtools/webpack`



