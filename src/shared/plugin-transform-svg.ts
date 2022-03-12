import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';

import { create_cached_fn } from '../utils/cached-fn.js';
import { normalize_path } from '../utils/path.js';
import { lazy } from '../utils/utils.js';
import { swc_transformer } from './js-transformers/swc.js';
import { TransformerOptions } from './js-transformers/types.js';

const require = createRequire(import.meta.url);

const svgr = lazy(() => {
  const module_path = require.resolve('@svgr/core', { paths: [process.cwd()] });
  return require(module_path); // TODO: type this
});

const svgr_config = lazy(async () => {
  const user_config = await svgr().resolveConfig(process.cwd());
  const config = user_config ? { ...defaultSVGRConfig, ...user_config } : defaultSVGRConfig;
  return config;
});

export const svg_plugin = (options: TransformerOptions): esbuild.Plugin => {
  return {
    name: 'svg',
    setup(build) {
      build.onLoad({ filter: /\.svg$/ }, async params => {
        const relative_path = normalize_path(params.path);
        const code_buffer = await readFile(relative_path);

        return svg_transformer_cached({ relative_path, code_buffer, ...options });
      });
    },
  };
};

const svg_transformer_cached = create_cached_fn({
  cache_name: 'transform-cache-svg',
  id_keys: ['relative_path', 'hmr'],
  fn: async function transform_svg(
    input: TransformerOptions & { relative_path: string; code_buffer: Buffer }
  ): Promise<esbuild.OnLoadResult | undefined> {
    const js = await svgr().transform(input.code_buffer.toString(), await svgr_config());

    const transformed = await swc_transformer({
      code: js,
      filepath: input.relative_path,
      loader: 'jsx',
      required_transforms: ['imports', 'es5-for-hermes'],
    });

    return { contents: transformed.code, loader: 'js' };
  },
});

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
