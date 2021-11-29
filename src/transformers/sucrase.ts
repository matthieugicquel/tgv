import type { TransformerFactory, TransformError } from './types';
import * as sucrase from 'sucrase';
import { select } from '../utils';

export const create_sucrase_transformer: TransformerFactory = options => {
  return function sucrase_transformer(input) {
    const necessary_transforms: sucrase.Transform[] = [];

    // We need to transform everything to CJS for our HMR hacks to work
    // The sucrase 'imports' transform adds "use strict" even when doing nothing, this can cause problems, for instance with react-native-safe-modules (used by lottie)
    // So only apply the transform when necessary
    if (options.hmr && is_esm_RegExp.test(input.code)) {
      necessary_transforms.push('imports');
    }

    // esbuild doesn't transform flow right now
    if ((input.loader === 'jsx' || input.loader === 'js') && flow_RegExp.test(input.filepath)) {
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
        // production: TODO
      });
      return {
        ...input,
        loader: 'js',
        code: transformed.code,
        // TODO: sourcemaps? sucrase preserves line so this isn't critical I think
      };
    } catch (error) {
      if (!is_sucrase_error(error)) throw error;

      const lineText = input.code.split('\n')[error.loc.line - 1];
      const formatted_error: TransformError = {
        pluginName: 'transform-js-sucrase',
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
  };
};

interface SucraseError extends Error {
  loc: {
    line: number;
    column: number;
  };
}

const is_sucrase_error = (error: unknown): error is SucraseError => {
  return (error as SucraseError).loc !== undefined;
};

const is_esm_RegExp = /(import|export)[\s\{\*]/;

const PACKAGES_WITH_FLOW = [
  'react-native',
  '@react-native',
  'react-native-screens',
  'react-native-code-push',
  'react-native-gesture-handler',
  'react-native-mixpanel',
  '@react-native-async-storage/async-storage',
  'react-native-share',
  'rn-fetch-blob',
  '@react-native-community/art',
  'react-native-pdf',
];

const flow_RegExp = new RegExp(`node_modules/(${PACKAGES_WITH_FLOW.join('|')})/.*(.js)$`);
