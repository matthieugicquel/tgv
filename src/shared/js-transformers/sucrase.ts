import without from 'lodash-es/without.js';
import * as sucrase from 'sucrase';

import { select } from '../../utils/utils.js';
import type { TransformData, TransformError } from './types';

export function sucrase_transformer(input: TransformData): TransformData {
  const necessary_transforms: sucrase.Transform[] = [];

  // We need to transform everything to CJS for our HMR hacks to work
  // The sucrase 'imports' transform adds "use strict" even when doing nothing, this can cause problems, for instance with react-native-safe-modules (used by lottie)
  // So only apply the transform when necessary
  // if (input.required_transforms.includes('imports')) {
  //   necessary_transforms.push('imports');
  // }

  // esbuild doesn't transform flow right now
  if (input.required_transforms.includes('flow')) {
    necessary_transforms.push('flow');
  }

  if (!necessary_transforms.length) return input;

  // JSX and TS could be handled by esbuild, but sucrase doesn't allow just applying the imports or flow transforms alone
  const supporting_transforms: sucrase.Transform[] = select(input.loader, {
    ts: ['typescript'],
    tsx: ['typescript', 'jsx'],
    jsx: ['jsx'],
    js: [],
  });

  const transforms = [...necessary_transforms, ...supporting_transforms];

  try {
    const transformed = sucrase.transform(input.code, {
      transforms,
      filePath: input.filepath,
      // disableESTransforms: true, // this should be handled by the rest of the chain, but for now some things break without it
      // production: TODO
    });
    return {
      ...input,
      required_transforms: without(input.required_transforms, 'flow'),
      loader: 'js',
      code: transformed.code,
      // TODO: sourcemaps? sucrase preserves line so this isn't critical I think
    };
  } catch (error) {
    if (!is_sucrase_error(error)) throw error;

    const lineText = input.code.split('\n')[error.loc.line - 1];
    const formatted_error: TransformError = {
      pluginName: 'sucrase',
      text: error.message as string,
      location: {
        file: input.filepath,
        line: error.loc.line,
        column: error.loc.column,
        length: lineText.length - error.loc.line,
        lineText,
      },
      detail: `transforms: ${transforms.join(',')}`,
    };
    throw formatted_error;
  }
}

interface SucraseError extends Error {
  loc: {
    line: number;
    column: number;
  };
}

const is_sucrase_error = (error: unknown): error is SucraseError => {
  return (error as SucraseError).loc !== undefined;
};
