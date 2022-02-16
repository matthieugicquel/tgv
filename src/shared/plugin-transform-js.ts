import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';

import { create_cached_fn } from '../utils/cached-fn.js';
import { normalize_path } from '../utils/path.js';
import { babel_with_pool } from './babel-with-pool.js';
import { determine_transforms } from './transformers/determine-transforms.js';
import { sucrase_transformer } from './transformers/sucrase.js';
import { swc_transformer } from './transformers/swc.js';
import { Loader, TransformData, TransformerOptions } from './transformers/types.js';

export const transform_js_plugin = (options: TransformerOptions): esbuild.Plugin => {
  return {
    name: 'transform-js',
    setup(build) {
      build.onLoad({ filter: /.*(js|jsx|ts|tsx)$/ }, create_js_multitransformer(options));
    },
  };
};

export const create_js_multitransformer = (options: TransformerOptions) => {
  return async function js_multitransformer(params: { path: string }) {
    const relative_path = normalize_path(params.path);
    const code_buffer = await readFile(relative_path);

    try {
      return await js_multitransformer_cached({ relative_path, code_buffer, ...options });
    } catch (error) {
      // This is probably an internal, uncontrolled error
      if (!is_transform_error(error)) throw error;
      return { errors: [error as esbuild.PartialMessage] };
    }
  };
};

const js_multitransformer_cached = create_cached_fn({
  cache_name: 'transform-cache',
  id_keys: ['relative_path', 'hmr', 'jsTarget'],
  fn: async function transform(
    input: TransformerOptions & { relative_path: string; code_buffer: Buffer }
  ): Promise<esbuild.OnLoadResult | undefined> {
    const { relative_path, code_buffer, ...options } = input;

    const loader = determine_loader(relative_path, input.transformPackages.jsxInJs);

    let data: TransformData = {
      code: code_buffer.toString(),
      filepath: relative_path,
      loader,
      required_transforms: [],
    };

    data.required_transforms = determine_transforms(options, data);

    // ⚠️ The babel reanimated plugin must run before the sucrase imports transform, otherwise it doesn't detect imports
    if (data.required_transforms.includes('reanimated2')) {
      data = await babel_with_pool(data);
    }

    if (data.required_transforms.includes('flow')) {
      data = sucrase_transformer(data);
    }

    if (
      data.required_transforms.includes('react-refresh') ||
      data.required_transforms.includes('es5-for-hermes') ||
      data.required_transforms.includes('imports')
    ) {
      data = await swc_transformer(data);
    }

    // if (options.hmr) {
    //   data.code = `${data.code}\nmodule.$FORCE_CJS = true;`;
    // }

    let warnings: esbuild.PartialMessage[] = [];
    if (data.required_transforms.length > 0) {
      warnings.push({
        text: `Unhandled necessary transforms: ${data.required_transforms.join(',')}`,
        location: {
          file: relative_path,
        },
      });
    }

    return { contents: data.code, loader, warnings };
  },
});

const is_transform_error = (error: unknown): error is esbuild.PartialMessage => {
  return 'location' in (error as esbuild.PartialMessage);
};

function determine_loader(path: string, transformPackages: string[]): Loader {
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.jsx')) return 'jsx';
  if (jsx_in_js_RegExp(transformPackages).test(path)) return 'jsx';
  return 'js';
}

const jsx_in_js_RegExp = (packages: string[]) => {
  return new RegExp(`node_modules/(${packages.join('|')})/.*(.js)$`);
};
