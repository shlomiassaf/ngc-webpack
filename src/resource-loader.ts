export let WebpackResourceLoader: { new (): any; get(filename: string): Promise<string>; };
export type WebpackResourceLoader = {
  new (): any; get(filename: string): Promise<string>;
  update(parentCompilation: any): void;
  getResourceDependencies(filePath: string): string[];
};

try {
  setFromNgTools();
  if (!WebpackResourceLoader) {
    setLocal();
  }
} catch (e) {
  setLocal();
}

function setFromNgTools() {
  const resourceLoader = require('@ngtools/webpack/src/resource_loader');
  WebpackResourceLoader = resourceLoader.WebpackResourceLoader;
}

function setLocal() {
  const resourceLoader = require('./_resource-loader');
  WebpackResourceLoader = resourceLoader.WebpackResourceLoader;
}