export type PathTransformer = (path: string) => string;
export type OnCompilationSuccess = () => void;
export type OnCompilationError = (err: Error) => void;

export interface NgcWebpackPluginOptions {
  pathTransformer?: PathTransformer;
  onCompilationSuccess?: OnCompilationSuccess;
  onCompilationError?: OnCompilationError;
}

export class NgcWebpackPlugin {
  constructor(public options: NgcWebpackPluginOptions = {} as any) {

  }

  apply(compiler: any) {

  }
}