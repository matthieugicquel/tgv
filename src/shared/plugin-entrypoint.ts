import type * as esbuild from 'esbuild';
import * as fs from 'fs';

export const entry_point_plugin = (entry_point: string): esbuild.Plugin => {
  const entry_point_RegExp = new RegExp(`${entry_point}$`);
  return {
    name: 'entry-point',
    setup(build) {
      build.onResolve({ filter: entry_point_RegExp }, ({ kind, path }) => {
        if (kind !== 'entry-point') return;

        return {
          path: `<tgv-entry>`,
          namespace: 'tgv-entry',
          pluginData: {
            entry_point_path: path,
          },
        };
      });

      build.onLoad({ namespace: 'tgv-entry', filter: /.*/ }, async ({ pluginData }) => {
        // For some reason we need to include these react-native polyfills before the index for things to work
        const contents = `${get_polyfills()}\rrequire('${pluginData.entry_point_path}');`;

        return {
          contents,
          resolveDir: process.cwd(),
          loader: 'js',
        };
      });
    },
  };
};

function get_polyfills() {
  // Just a little of backwards compatibility, will probably not try to support more versions
  if (fs.existsSync('node_modules/react-native/Libraries/polyfills/Object.es7.js')) {
    return `
require('react-native/Libraries/polyfills/console');
require('react-native/Libraries/polyfills/error-guard');
require('react-native/Libraries/polyfills/Object.es7');
require('react-native/Libraries/Core/setUpPerformance');
`;
  }

  return `
require('@react-native/polyfills/console');
require('@react-native/polyfills/error-guard');
require('@react-native/polyfills/Object.es8');
require('react-native/Libraries/Core/setUpPerformance');
`;
}
