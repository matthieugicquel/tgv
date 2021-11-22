import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { assets_plugin } from './esbuild-plugins/assets';
import { hot_module_plugin } from './esbuild-plugins/hot-module';
import { inject_runtime_plugin } from './esbuild-plugins/inject-runtime';
import { transform_js_dev_plugin, transform_js_plugin } from './esbuild-plugins/transform-js';
import { transform_json_dev_plugin } from './esbuild-plugins/transform-json';

type BundleParams = {
  entryPoint: string;
  platform: 'ios' | 'android';
};

type BundleResult = {
  code: Uint8Array;
  map: Uint8Array;
  metafile: esbuild.Metafile;
};

export async function bundle({ entryPoint, platform }: BundleParams): Promise<BundleResult> {
  const result = await esbuild.build({
    ...compute_build_options({
      platform,
      define: {
        // TODO: even with this, esbuild doesn't remove files like ReactNativeRenderer-dev from the prod bundle
        __DEV__: 'true',
      },
    }),
    stdin: preprend_polyfills_to_entryPoint(entryPoint),
    plugins: [assets_plugin(), transform_js_plugin()],
    logLevel: 'info',
    logLimit: 10,
    minify: false,
  });

  return {
    code: result.outputFiles[1].contents,
    map: result.outputFiles[0].contents,
    metafile: result.metafile as esbuild.Metafile, // We passed the option, we know it's there
  };
}

type BundleForHMRParams = BundleParams & {
  client_id: string;
  port: number;
};

type BundleForHMRResult = BundleResult & {
  included_modules: Set<string>;
  build_for_hmr: (entryPoint: string) => Promise<{ code: string; map: string }>;
};

/**
 * The resulting bundle contains these items in this order:
 * - Some basic polyfills
 *   - console is used by the HMR require wrappers
 *   - error-guard I'm not sure if it's needed
 *   - Object.es7 is used by the esbuild bundle helpers (I think)
 * - The HMR require wrappers (`before-modules.ts`)
 * - The app bundle
 *   - Injected inside, where `setUpReactRefresh` would be, our own runtime code (`after-setup.ts`, see `inject_runtime_plugin`)
 * - A footer that tells us initialization is done
 */
export async function bundle_for_hmr({
  platform,
  entryPoint,
  client_id,
  port,
}: BundleForHMRParams): Promise<BundleForHMRResult> {
  const build_options = compute_build_options({
    platform,
    define: {
      $TGV_PORT: port.toString(),
      $TGV_CLIENT_ID: `'${client_id}'`,
      __DEV__: 'true',
    },
  });

  // This must be defined in the banner, before any bundle code (which uses the wrappers) is executed
  const banner = (
    await esbuild.build({
      ...build_options,
      entryPoints: [path.join(__dirname, 'runtimes/before-modules.ts')],
      nodePaths: [path.join(process.cwd(), 'node_modules')], // To resolve react-refresh to the locally installed package
    })
  ).outputFiles[1].text;

  const result = await esbuild.build({
    ...build_options,
    stdin: preprend_polyfills_to_entryPoint(entryPoint),
    banner: { js: banner },
    footer: { js: 'globalThis.$IS_INITIALIZED = true' },
    plugins: [
      assets_plugin(),
      inject_runtime_plugin(),
      transform_js_dev_plugin(),
      transform_json_dev_plugin(),
    ],
  });

  // Keep track of which deps have been sent to this client
  // TODO: is using the metafile for that reliable?
  const client_cached_modules = new Set(Object.keys(result.metafile?.inputs ?? {}));

  return {
    code: result.outputFiles[1].contents,
    map: result.outputFiles[0].contents,
    metafile: result.metafile as esbuild.Metafile, // We passed the option, we know it's there
    included_modules: client_cached_modules,
    async build_for_hmr(entryPoint: string) {
      try {
        const result = await esbuild.build({
          ...build_options,
          entryPoints: [entryPoint],
          plugins: [
            assets_plugin(),
            transform_json_dev_plugin(),
            hot_module_plugin(client_cached_modules),
          ],
        });

        for (const dep of Object.keys(result.metafile?.inputs ?? {})) {
          client_cached_modules.add(dep);
        }

        return {
          code: result.outputFiles[1].text,
          map: result.outputFiles[0].text,
        };
      } catch (error) {
        throw (error as esbuild.BuildFailure).errors;
      }
    },
  };
}

const compute_build_options = ({
  define = {},
  platform,
}: {
  platform: 'ios' | 'android';
  define?: esbuild.BuildOptions['define'];
}): esbuild.BuildOptions & { write: false; metafile: true } => {
  return {
    bundle: true,
    write: false,
    outdir: '.tgv-cache', // in theory esbuild won't write anything, but it complains if we don't specify an outdir
    target: 'safari11', // iOS 11 is the oldest version supported by react-native. TODO: hermes needs more transforms...
    format: 'iife',
    charset: 'utf8',
    sourcemap: 'external',
    legalComments: 'none',
    metafile: true,
    logLevel: 'silent', // TODO: cleaner error handling
    loader: { '.js': 'jsx' }, // The react-native ecosystem has lots of jsx in js files
    resolveExtensions: [
      '.native.tsx',
      '.native.ts',
      '.native.jsx',
      '.native.js',
      `.${platform}.tsx`,
      `.${platform}.ts`,
      `.${platform}.jsx`,
      `.${platform}.js`,
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
    // It would be better for tree-shaking to move the 'module' field up in the list.
    // But it causes issues, for instance with react-query
    mainFields: ['react-native', 'browser', 'main', 'module'],
    define: {
      global: 'globalThis',
      window: 'globalThis',
      ...define,
    },
  };
};

function preprend_polyfills_to_entryPoint(entryPoint: string) {
  // For some reason we need to include these react-native polyfills before the index for things to work
  const entryPoint_with_polyfills = `
${get_polyfills()}
import './${entryPoint}';
`;

  return {
    contents: entryPoint_with_polyfills,
    resolveDir: path.dirname(entryPoint),
    sourcefile: 'index-with-polyfills.js',
  };
}

const get_polyfills = () => {
  // Just a little of backwards compatibility, will probably not try to support more versions
  if (fs.existsSync('node_modules/react-native/Libraries/polyfills/Object.es7.js')) {
    return `
import 'react-native/Libraries/polyfills/console';
import 'react-native/Libraries/polyfills/error-guard';
import 'react-native/Libraries/polyfills/Object.es7';
`;
  }

  return `
import '@react-native/polyfills/console';
import '@react-native/polyfills/error-guard';
import '@react-native/polyfills/Object.es8';
`;
};
