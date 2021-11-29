import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { Transform, Writable } from 'stream';
import { assets_plugin } from './esbuild-plugins/assets';
import { hot_module_plugin } from './esbuild-plugins/hot-module';
import { inject_runtime_plugin } from './esbuild-plugins/inject-runtime';
import { transform_js_dev_plugin, transform_js_plugin } from './esbuild-plugins/transform-js';

type BundleParams = {
  entryPoint: string;
  platform: 'ios' | 'android';
};

type BundleResult = {
  code: string;
  map: string;
  metafile: esbuild.Metafile;
};

export async function bundle({ entryPoint, platform }: BundleParams): Promise<BundleResult> {
  const result = await esbuild.build({
    ...compute_build_options({
      platform,
      define: {
        __DEV__: 'false',
      },
    }),
    stdin: preprend_polyfills_to_entryPoint(entryPoint),
    plugins: [assets_plugin(), transform_js_plugin()],
    logLevel: 'info',
    logLimit: 10,
    minify: true,
  });

  return {
    code: result.outputFiles[1].text,
    map: result.outputFiles[0].text,
    metafile: result.metafile as esbuild.Metafile, // We passed the option, we know it's there
  };
}

type BundleForHMRParams = BundleParams & {
  client_id: string;
  port: number;
  code_stream: Writable;
};

type BundleForHMRResult = {
  included_modules: Set<string>;
  build_for_hmr: (changed_files: string[]) => Promise<{ code: string; map: string }>;
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
  code_stream,
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
  ).outputFiles[1].contents;

  code_stream.write(banner);

  const result = await esbuild.build({
    ...build_options,
    stdin: preprend_polyfills_to_entryPoint(entryPoint),
    plugins: [assets_plugin(), inject_runtime_plugin(), transform_js_dev_plugin()],
    // Going through fs is faster than going through esbuild's stdio protocol
    // TODO: This will 💣 if multiple clients are connected at the same time
    write: true,
  });

  // Keep track of which deps have been sent to this client
  // TODO: is using the metafile for that reliable?
  const client_cached_modules = new Set(Object.keys(result.metafile?.inputs ?? {}));

  const esbuild_code_stream = fs.createReadStream('.tgv-cache/stdin.js', 'utf8');
  esbuild_code_stream.pipe(create_cjs_override_transform()).pipe(code_stream);

  // Create the plugins here to not recreate them every time there's a hot reload
  const hot_plugins: esbuild.Plugin[] = [assets_plugin(), hot_module_plugin(client_cached_modules)];

  return {
    included_modules: client_cached_modules,
    async build_for_hmr(changed_files: string[]) {
      for (const file of changed_files) client_cached_modules.delete(file);

      const entry_point_contents = changed_files.map(file => `import '${file}';`).join('\n');

      try {
        const result = await esbuild.build({
          ...build_options,
          stdin: {
            contents: entry_point_contents,
            resolveDir: process.cwd(),
            sourcefile: 'latest-hmr.js',
          },
          plugins: hot_plugins,
        });

        for (const dep of Object.keys(result.metafile?.inputs ?? {})) {
          client_cached_modules.add(dep);
        }

        return {
          code: override_cjs_helper_hmr(result.outputFiles[1].text, changed_files),
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

function create_cjs_override_transform() {
  let is_done = false;
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (is_done) {
        callback(null, chunk);
        return;
      }
      const string_content = chunk.toString();
      if (!esbuild_helper_regExp.test(string_content)) {
        callback(null, chunk);
        return;
      }
      // It's a match!
      is_done = true;
      callback(null, override_cjs_helper_bundle(string_content));
    },
  });
}

function override_cjs_helper_bundle(bundle_with_runtime: string) {
  return bundle_with_runtime.replace(
    esbuild_helper_regExp,
    'var __commonJS = globalThis.$COMMONJS;'
  );
}

function override_cjs_helper_hmr(hmr_bundle: string, changed_modules: string[]) {
  return hmr_bundle.replace(
    esbuild_helper_regExp,
    `var __commonJS = globalThis.$COMMONJS_HOT(${JSON.stringify(changed_modules)});`
  );
}

const esbuild_helper_regExp = /var __commonJS.*\n.*\n\s*};/;
