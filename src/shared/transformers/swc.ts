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
        // es2022 would probably be ok, but has this bug that I encountered: https://play.swc.rs/?version=1.2.143&code=H4sIAAAAAAAAA8vMLcgvKlEIycjMS1dIK8rPVVAvAbHVrbm4UivAcsk5icXFCr6VzmC6mksBCIpLEksykxVyK31Tc5NSixRsISZw1XIBAH7iUatRAAAA&config=H4sIAAAAAAAAA0WOSw6DMAxE7%2BI1i4olN%2BiCQ1jBoKAkjmwjNUXcvYnKZ%2BXfm%2FHssKqDYYeMoiSt05IMPzAAuYjqxGeDrmJ1NWNQOjowlIWsIdq%2F%2Br6eA7PSCXQQffJzaWaOYxZSfU6YlnCRR%2FWKPG1tsYOVXGuTRE6rVlc18c5u7X8ceXo%2BBfyWe0j8TkbC%2BUl6JTkJr%2BP5zmSj4wdXwMn%2F%2FgAAAA%3D%3D
        target: input.required_transforms.includes('es5-for-hermes') ? 'es5' : 'es2021',
        minify: {
          // Without this explicitly to false, swc creates invalid code for reanimated: https://play.swc.rs/?version=1.2.143&code=H4sIAAAAAAAAA1WNwQrCMBBE7%2FsVe%2BvFdvDck%2FghEpIVok1WdqMUiv9uqYL0No%2FHzABcNcmlaHpO4jAJsfU1tPySfoWaS2iS4BbxxyNyTTIPNyfK5aHW%2BPRT50njna%2BmhbsBUU2wU91IJPNWWYgZ339f434hOG%2FhQO%2BRPjhGrWemAAAA&config=H4sIAAAAAAAAA0WMQQ6AIAwE%2F7JnDsrR3zRYjQYooTXRGP4unDztZmeyL04NWF4Uqsp1NH2y0Y0FHBJpqEcxuK71aaOo3ByM6s42FPWTnzuOIsq%2FkGS9Io83e0pPBElJ8qlo7QN0SnF8cwAAAA%3D%3D
          compress: false,
        },
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
    throw error;
  }
}
