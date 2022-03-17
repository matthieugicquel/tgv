import type * as esbuild from 'esbuild';
import * as path from 'path';

import { TGVPlugin } from '../../plugins/types.js';
import { create_multitransformer } from '../../shared/esbuild-plugin-transform.js';
import { module_dirname } from '../../utils/path.js';

/**
 * Replace the refresh setup included in react-native with ours
 * Doing it this ways has 2 benefits:
 * - The original setup is not included, it avoids conflicts
 * - All the necessary polyfills are already setup by react-native at this point in the code
 */
export const esbuild_plugin_hmr_bundle = (plugins: TGVPlugin[]): esbuild.Plugin => {
  return {
    name: 'hmr-bundle',
    setup(build) {
      const { filter, transform } = create_multitransformer({
        hmr: true,
        plugins,
      });

      // TODO: better RegExp
      build.onLoad({ filter: new RegExp('setUpReactRefresh') }, async () => {
        // We don't use an onResolve callback because we want this file to be in the context of the files it replaces when it comes to resolving
        const filepath = path.join(module_dirname(import.meta), '../runtimes/ws-client.runtime.js');
        return transform({
          path: filepath,
        });
      });

      build.onLoad({ filter }, transform);

      // TODO: inject something that allows logging, like expected by node_modules/react-native/Libraries/Core/setUpDeveloperTools.js
      // build.onResolve({ filter: new RegExp('(Utilities/HMRClient$') }, () => {
      //   return { contents: '' };
      // });
    },
  };
};
