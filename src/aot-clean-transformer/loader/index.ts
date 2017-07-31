import { loader as l } from 'webpack';

import { aotCleanLoader as aotCleanLoaderText } from './text-based-loader';
import { aotCleanLoader as aotCleanLoaderTransformer } from './transformer-based-loader';

let useTransformerBased: boolean;

export function useTransformerBasedLoader(value: boolean): void {
  useTransformerBased = value;
}

export default function aotCleanLoader(this: l.LoaderContext & { _compilation: any }, source: string | null, sourceMap: string | null) {
  if (useTransformerBased === true) {
    return aotCleanLoaderTransformer.call(this, source, sourceMap);
  } else {
    return aotCleanLoaderText.call(this, source, sourceMap);
  }
}