export type PathTransformer = (path: string) => string;

export interface NgcWebpackPluginOptions {
  pathTransformer?: PathTransformer
}
export class NgcWebpackPlugin {
  constructor(public options: NgcWebpackPluginOptions = {} as any) {

  }

  apply(compiler: any) {

  }
}