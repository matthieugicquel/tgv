import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import { dirname } from 'path';

import { normalize_path } from '../utils/path.js';
import { lazy } from '../utils/utils.js';

const require = createRequire(import.meta.url);

const svgr = lazy(() => {
  const module_path = require.resolve('@svgr/core', { paths: [process.cwd()] });
  return require(module_path) as typeof import('@svgr/core');
});

export const svg_plugin = (): esbuild.Plugin => {
  return {
    name: 'svg',
    setup(build) {
      build.onLoad({ filter: /\.svg$/ }, async params => {
        const user_config = await svgr().resolveConfig(dirname(params.path));
        const config = user_config ? { ...defaultSVGRConfig, ...user_config } : defaultSVGRConfig;

        const relative_path = normalize_path(params.path);
        const code = await readFile(relative_path, 'utf8');

        const contents = await svgr().transform(code, config);

        return {
          contents,
          resolveDir: process.cwd(),
          loader: 'jsx',
        };
      });
    },
  };
};

const defaultSVGRConfig = {
  native: true,
  plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
  svgoConfig: {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            inlineStyles: {
              onlyMatchedOnce: false,
            },
            removeViewBox: false,
            removeUnknownsAndDefaults: false,
            convertColors: false,
          },
        },
      },
    ],
  },
};
