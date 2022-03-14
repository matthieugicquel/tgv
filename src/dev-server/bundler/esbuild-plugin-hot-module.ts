import type * as esbuild from 'esbuild';

import { TGVPlugin } from '../../plugins/types.js';
import { create_multitransformer } from '../../shared/esbuild-plugin-transform.js';
import { normalize_path } from '../../utils/path.js';
import { dedupe } from '../../utils/utils.js';

export const esbuild_plugin_hot_module = (
  client_cached_modules: Set<string>,
  plugins: TGVPlugin[]
): esbuild.Plugin => {
  const transform = create_multitransformer({
    hmr: true,
    plugins,
  });

  return {
    name: 'hot-module',
    setup(build) {
      const extensions = dedupe(plugins.flatMap(plugin => plugin.filter.loaders ?? []));
      const filter = new RegExp(`\\.(${extensions.join('|')})$`);

      build.onLoad({ filter }, ({ path }) => {
        const relative_path = normalize_path(path);
        if (client_cached_modules.has(relative_path)) {
          // This is a dependency that's already present in the client -> don't include it
          // `module.__hot_cached isn't included, it just makes sure that esbuild doesn't make the module `undefined`
          // The require will be intercepted by the runtime and the cached version will be used
          return { contents: 'module.__hot_cached = true', loader: 'js' };
        }

        // This a dependency that's not present in the client, or has been invalidated -> include it in what we send
        return transform({ path: relative_path });
      });
    },
  };
};
