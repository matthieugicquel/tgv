import type * as esbuild from 'esbuild';
import { normalize_path } from '../path-utils';
import { transform_js_dev } from './transform-js';

export const hot_module_plugin = (client_cached_modules: Set<string>): esbuild.Plugin => {
  const cached_module_require = (identifier: string) => {
    return `$REQUIRE_CACHED(exports, module, '${identifier}');`;
  };

  let resolved_module_path: string | undefined;
  return {
    name: 'hot-module',
    setup(build) {
      build.onLoad({ filter: /.*(js|jsx|ts|tsx)$/ }, ({ path }) => {
        const relative_path = normalize_path(path);

        if (!resolved_module_path) {
          // This is the entry point, the module we want to hot-replace -> include it
          resolved_module_path = relative_path;
          return transform_js_dev({ path: relative_path });
        }

        if (client_cached_modules.has(relative_path)) {
          // This is a dependency that's already present in the client -> don't include it
          return { contents: cached_module_require(relative_path), loader: 'js' };
        }

        // This a dependency that's not present in the client -> include it in what we send
        return transform_js_dev({ path: relative_path });
      });
    },
  };
};
