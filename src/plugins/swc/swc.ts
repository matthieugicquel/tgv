import swc_core from '@swc/core';

import { select } from '../../utils/utils.js';
import { TGVPlugin, TGVPluginTransformError } from '../types.js';

export function swc(): TGVPlugin {
  return {
    name: 'swc',
    filter: {
      loaders: ['js', 'jsx', 'cjs', 'ts', 'tsx'],
    },
    async transform(input) {
      try {
        const transformed = await swc_core.transform(input.code, {
          sourceRoot: process.cwd(),
          sourceFileName: input.relative_path,
          filename: input.relative_path,
          swcrc: false,
          configFile: false,
          sourceMaps: 'inline',
          ...(input.hmr && {
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
            target: 'es5',
            minify: {
              // Without this explicitly to false, swc creates invalid code for reanimated: https://play.swc.rs/?version=1.2.143&code=H4sIAAAAAAAAA1WNwQrCMBBE7%2FsVe%2BvFdvDck%2FghEpIVok1WdqMUiv9uqYL0No%2FHzABcNcmlaHpO4jAJsfU1tPySfoWaS2iS4BbxxyNyTTIPNyfK5aHW%2BPRT50njna%2BmhbsBUU2wU91IJPNWWYgZ339f434hOG%2FhQO%2BRPjhGrWemAAAA&config=H4sIAAAAAAAAA0WMQQ6AIAwE%2F7JnDsrR3zRYjQYooTXRGP4unDztZmeyL04NWF4Uqsp1NH2y0Y0FHBJpqEcxuK71aaOo3ByM6s42FPWTnzuOIsq%2FkGS9Io83e0pPBElJ8qlo7QN0SnF8cwAAAA%3D%3D
              compress: false,
            },
            transform: {
              react: {
                refresh: input.hmr,
              },
            },
          },
        });

        return {
          ...input,
          loader: 'js',
          code: transformed.code,
        };
      } catch (error) {
        if (!is_swc_error(error)) throw error;

        // TODO: cleaner errors
        const formatted_error: TGVPluginTransformError = {
          text: error.message as string,
          location: {},
        };
        throw formatted_error;
      }
    },
  };
}

interface SwcError extends Error {
  code: string;
}

const is_swc_error = (error: unknown): error is SwcError => {
  return (error as SwcError).code !== undefined;
};
