import type * as esbuild from 'esbuild';

import { SupportedPlatform } from '../utils/platform.js';

type Customizations = {
  platform: SupportedPlatform;
  define?: esbuild.BuildOptions['define'];
};

type BuildOptions = esbuild.BuildOptions & { write: false; metafile: true };

export function compute_esbuild_options(options: Customizations): BuildOptions {
  const { define = {}, platform } = options;

  return {
    bundle: true,
    write: false,
    // For the ES5 target to work with esbuild, many features like let/const, destructuring must have been pre-transpiled. This is done by SWC
    target: 'es5',
    format: 'iife',
    charset: 'utf8',
    sourcemap: 'external',
    legalComments: 'none',
    metafile: true,
    logLevel: 'silent',
    loader: { '.js': 'jsx' },
    resolveExtensions: [
      '.native.tsx',
      '.native.ts',
      '.native.jsx',
      '.native.js',
      `.${platform}.tsx`,
      `.${platform}.ts`,
      `.${platform}.jsx`,
      `.${platform}.js`,
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
    // It would be better for tree-shaking to move the 'module' field up in the list.
    // But it causes issues, for instance with react-query or datadog
    mainFields: ['react-native', 'browser', 'main', 'module'],
    define: {
      global: 'globalThis',
      window: 'globalThis',
      ...define,
    },
  };
}
