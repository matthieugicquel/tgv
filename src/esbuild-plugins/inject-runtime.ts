import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import * as path from 'path';

/**
 * Replace the refresh setup included in react-native with ours
 * Doing it this ways has 2 benefits:
 * - The original setup is not included, it avoids conflicts
 * - All the necessary polyfills are already setup by react-native at this point in the code
 */
export const inject_runtime_plugin = (): esbuild.Plugin => {
  return {
    name: 'inject-runtime',
    setup(build) {
      // TODO: better RegExp
      build.onLoad({ filter: new RegExp('setUpReactRefresh') }, async () => {
        // We don't use an onResolve callback because we want this file to be in the context of the files it replaces when it comes to resolving
        const filepath = path.join(__dirname, '../runtimes/after-setup.ts');
        const contents = await readFile(filepath, 'utf8');
        return { contents, loader: 'ts' };
      });

      // TODO: inject something that allows logging, like expected by node_modules/react-native/Libraries/Core/setUpDeveloperTools.js
      // build.onResolve({ filter: new RegExp('(Utilities/HMRClient$') }, () => {
      //   return { contents: '' };
      // });
    },
  };
};
