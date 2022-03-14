import { createRequire } from 'module';

import { lazy } from '../../utils/utils.js';
import { TGVPlugin } from '../types.js';

const require = createRequire(import.meta.url);

const get_svgr = lazy(async () => {
  const module_path = require.resolve('@svgr/core', { paths: [process.cwd()] });
  const svgr_module = require(module_path);

  const user_config = await svgr_module.resolveConfig(process.cwd());
  const config = user_config ? { ...defaultSVGRConfig, ...user_config } : defaultSVGRConfig;

  return (code: string) => svgr_module.transform(code, config);
});

export const svg = (): TGVPlugin => {
  return {
    name: 'svg',
    filter: {
      loaders: ['svg'],
    },
    async transform(input) {
      const transform_with_svgr = await get_svgr();
      return {
        ...input,
        code: await transform_with_svgr(input.code),
        loader: 'jsx',
      };
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
