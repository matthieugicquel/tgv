import type * as esbuild from 'esbuild';
import { normalize_path } from '../path-utils';
import { create_js_multitransformer } from './transform-js';

export const hot_module_plugin = (client_cached_modules: Set<string>): esbuild.Plugin => {
  const transformer = create_js_multitransformer({ hermes: false, hmr: true });

  return {
    name: 'hot-module',
    setup(build) {
      build.onLoad({ filter: /.*(js|jsx|ts|tsx)$/ }, ({ path }) => {
        const relative_path = normalize_path(path);
        if (client_cached_modules.has(relative_path)) {
          // This is a dependency that's already present in the client -> don't include it
          // The require will be intercepted by the runtime and the cached version will be used
          return { contents: '', loader: 'js' };
        }

        // This a dependency that's not present in the client, or has been invalidated -> include it in what we send
        return transformer({ path: relative_path });
      });
    },
  };
};
