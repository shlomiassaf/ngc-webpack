const sorcery = require('sorcery');

export async function remapSourceMap(sourceFile: string, options: any = {}): Promise<void> {
  return sorcery.load(sourceFile)
    .then( chain => {
      if (!chain) {
        throw new Error('Failed to load sourceMap chain for ' + sourceFile);
      }
      return chain.write(options);
    });
}
