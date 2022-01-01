import swc from '@swc/core';
import without from 'lodash-es/without.js';

import { select } from '../../utils/utils.js';
import type { TransformData } from './types';

export async function swc_transformer(input: TransformData): Promise<TransformData> {
  try {
    const transformed = await swc.transform(input.code, {
      filename: input.filepath,
      swcrc: false,
      sourceMaps: true,
      ...(input.required_transforms.includes('imports') && {
        module: {
          type: 'commonjs',
        },
      }),
      jsc: {
        parser: {
          syntax: select(input.loader, {
            ts: 'typescript',
            tsx: 'typescript',
            jsx: 'ecmascript',
            js: 'ecmascript',
          }),
          tsx: input.loader === 'tsx' ? true : undefined,
          jsx: input.loader === 'jsx' ? true : undefined,
        },
        // esbuild handles transpiling to ES6, we just need swc for transpiling to ES5 for hermes
        target: input.required_transforms.includes('es5-for-hermes') ? 'es5' : 'es2022',
        transform: {
          react: {
            refresh: input.required_transforms.includes('react-refresh'),
          },
        },
      },
    });

    return {
      ...input,
      required_transforms: without(
        input.required_transforms,
        'imports',
        'es5-for-hermes',
        'react-refresh'
      ),
      loader: 'js',
      code: transformed.code,
    };
  } catch (error) {
    console.log('hello swc', error);
    throw error;
  }
}
