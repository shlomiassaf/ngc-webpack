
export type ResourcePathTransformer = (path: string) => string;
/**
 * @deprecated Use ResourcePathTransformer
 */
export type PathTransformer = ResourcePathTransformer;

export type ResourceTransformer = (path: string, source: string) => string | Promise<string>;
/**
 * @deprecated Use SourceTransformer
 */
export type SourceTransformer = ResourceTransformer;

export type BeforeRunHandler = (loader: { get(filename: string): Promise<string> }) => Promise<void>;
export type ReadFileTransformer = (path: string, source: string) => string;
export type OnCompilationSuccess = () => void;
export type OnCompilationError = (err: Error) => void;

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
   * @deprecated Use resourcePathTransformer
   */
  pathTransformer?: PathTransformer;
  /**
   * @deprecated Use resourceTransformer
   */
  sourceTransformer?: SourceTransformer;

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