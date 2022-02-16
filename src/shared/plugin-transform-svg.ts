import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import { dirname } from 'path';

import { normalize_path } from '../utils/path.js';
import { lazy } from '../utils/utils.js';
import { swc_transformer } from './transformers/swc.js';
import { TransformerOptions } from './transformers/types.js';

const require = createRequire(import.meta.url);

const svgr = lazy(() => {
  const module_path = require.resolve('@svgr/core', { paths: [process.cwd()] });
  return require(module_path); // TODO: type this
});

export const svg_plugin = (js_transform_options: TransformerOptions): esbuild.Plugin => {
  return {
    name: 'svg',
    setup(build) {
      build.onLoad({ filter: /\.svg$/ }, async params => {
        const user_config = await svgr().resolveConfig(dirname(params.path));
        const config = user_config ? { ...defaultSVGRConfig, ...user_config } : defaultSVGRConfig;

        const relative_path = normalize_path(params.path);
        const source = await readFile(relative_path, 'utf8');

        const js = await svgr().transform(source, config);

        // TODO
        const transformed = await swc_transformer({
          code: js,
          filepath: relative_path,
          loader: 'jsx',
          required_transforms: ['imports', 'es5-for-hermes'],
        });

        return { contents: transformed.code, loader: 'js' };
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
