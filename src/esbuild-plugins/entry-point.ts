import type * as esbuild from 'esbuild';
import * as fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

export const entry_point_plugin = (entry_point: string): esbuild.Plugin => {
  const entry_point_RegExp = new RegExp(`${entry_point}$`);
  return {
    name: 'entry-point',
    setup(build) {
      build.onResolve({ filter: entry_point_RegExp }, ({ kind }) => {
        if (kind !== 'entry-point') return;

        return {
          path: path.resolve(process.cwd(), entry_point),
          namespace: 'tgv-entry',
        };
      });

      build.onLoad({ namespace: 'tgv-entry', filter: /.*/ }, async () => {
        const real_entry_point = await readFile(entry_point, 'utf8');

        // For some reason we need to include these react-native polyfills before the index for things to work
        const contents = `${get_polyfills()}\n${real_entry_point}`;

        return {
          contents,
          resolveDir: process.cwd(),
          loader: 'js',
        };
      });
    },
  };
};

const get_polyfills = () => {
  // Just a little of backwards compatibility, will probably not try to support more versions
  if (fs.existsSync('node_modules/react-native/Libraries/polyfills/Object.es7.js')) {
    return `
import 'react-native/Libraries/polyfills/console';
import 'react-native/Libraries/polyfills/error-guard';
import 'react-native/Libraries/polyfills/Object.es7';
import 'react-native/Libraries/Core/InitializeCore';
`;
  }

  return `
import '@react-native/polyfills/console';
import '@react-native/polyfills/error-guard';
import '@react-native/polyfills/Object.es8';
// When adding reanimated, without this I get "can't find variable: setImmediate"
// May be solved by https://github.com/software-mansion/react-native-reanimated/issues/2621
import 'react-native/Libraries/Core/InitializeCore';
`;
};
