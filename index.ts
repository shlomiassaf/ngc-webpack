export * from './src/plugin';
export { aotCleanupTransformer, patching } from './src/aot-clean-transformer';

export { useTransformerBasedLoader } from './src/aot-clean-transformer/loader';

import aotCleanLoader from './src/aot-clean-transformer/loader';
export default aotCleanLoader;


