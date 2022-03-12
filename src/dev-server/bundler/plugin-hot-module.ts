import type * as esbuild from 'esbuild';

import { TransformerOptions } from '../../shared/js-transformers/types.js';
import { create_js_multitransformer } from '../../shared/plugin-transform-js.js';
import { normalize_path } from '../../utils/path.js';

export const hot_module_plugin = (
  client_cached_modules: Set<string>,
  transform_options: TransformerOptions
): esbuild.Plugin => {
  const transformer = create_js_multitransformer(transform_options);

  return {
    name: 'hot-module',
    setup(build) {
      build.onLoad({ filter: /.*(js|jsx|ts|tsx)$/ }, ({ path }) => {
        const relative_path = normalize_path(path);
        if (client_cached_modules.has(relative_path)) {
          // This is a dependency that's already present in the client -> don't include it
          // `module.__hot_cached isn't included, it just makes sure that esbuild doesn't make the module `undefined`
          // The require will be intercepted by the runtime and the cached version will be used
          return { contents: 'module.__hot_cached = true', loader: 'js' };
        }

        // This a dependency that's not present in the client, or has been invalidated -> include it in what we send
        return transformer({ path: relative_path });
      });
    },
  };
};
