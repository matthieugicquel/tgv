import * as sucrase from 'sucrase';

import { dedupe } from '../../utils/utils.js';
import { TGVPlugin, TGVPluginTransformError } from '../types.js';

export const flow = ({ packages }: { packages: string[] } = { packages: [] }): TGVPlugin => {
  return {
    name: 'flow',
    filter: {
      loaders: ['js', 'jsx'],
      packages: dedupe([...packages, ...transform_flow_default]),
    },
    transform(input) {
      try {
        const transformed = sucrase.transform(input.code, {
          transforms: ['flow', 'jsx'],
          filePath: input.relative_path,
          // disableESTransforms: true, // this should be handled by the rest of the chain, but for now some things break without it
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
        const formatted_error: TGVPluginTransformError = {
          text: error.message as string,
          location: {
            line: error.loc.line,
            column: error.loc.column,
            length: lineText.length - error.loc.line,
            lineText,
          },
        };
        throw formatted_error;
      }
    },
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

const transform_flow_default = [
  'react-native',
  '@react-native',
  'react-native-screens',
  'react-native-gesture-handler',
  '@react-native-async-storage/async-storage',
  '@react-native-community/art',
  '@react-native-community/progress-bar-android',
];
