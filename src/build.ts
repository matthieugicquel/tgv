import * as esbuild from 'esbuild';
import * as fs from 'fs';
import without from 'lodash-es/without';
import keys from 'lodash-es/keys';
import * as path from 'path';
import { Transform, Writable } from 'stream';
import { assets_plugin } from './esbuild-plugins/assets';
import { entry_point_plugin } from './esbuild-plugins/entry-point';
import { hot_module_plugin } from './esbuild-plugins/hot-module';
import { inject_runtime_plugin } from './esbuild-plugins/inject-runtime';
import { transform_js_dev_plugin, transform_js_plugin } from './esbuild-plugins/transform-js';

export type DevBundlerParams = {
  entryPoint: string;
  platform: 'ios' | 'android';
};

export async function bundle({ entryPoint, platform }: DevBundlerParams): Promise<void> {
  await esbuild.build({
    ...compute_build_options({
      platform,
      define: {
        __DEV__: 'false',
      },
    }),
    write: true,
    entryPoints: [entryPoint],
    plugins: [entry_point_plugin(entryPoint), assets_plugin(), transform_js_plugin()],
    logLevel: 'info',
    logLimit: 10,
    minify: true,
  });
}

export type DevBundler = ReturnType<typeof create_dev_bundler>;

export function create_dev_bundler({ entryPoint, platform }: DevBundlerParams) {
  const base_build_options = {
    ...compute_build_options({
      platform,
      define: {
        __DEV__: 'true',
      },
    }),
    treeShaking: false, // It could mess with HMR
  };

  const banner_promise = esbuild.build({
    ...base_build_options,
    entryPoints: [path.join(__dirname, 'runtimes/before-modules.ts')],
    nodePaths: [path.join(process.cwd(), 'node_modules')], // To resolve react-refresh to the locally installed package
  });

  const full_options = {
    ...base_build_options,
    entryPoints: [entryPoint],
    // Going through fs is faster than going through esbuild's stdio protocol
    // TODO: This will 💣 if multiple clients are connected at the same time
    write: true,
    incremental: true,
    plugins: [
      entry_point_plugin(entryPoint),
      assets_plugin(),
      inject_runtime_plugin(),
      transform_js_dev_plugin(),
    ],
  };

  let rebuild: esbuild.BuildInvalidate;

  return function bundler_for_client(socket_url: string) {
    const ClientKnownModules = new Set<string>();

    const hmr_plugins: esbuild.Plugin[] = [assets_plugin(), hot_module_plugin(ClientKnownModules)];

    return {
      async build_full_bundle(code_stream: Writable) {
        try {
          ClientKnownModules.clear();

          const result = rebuild ? await rebuild() : await esbuild.build(full_options);

          rebuild = result.rebuild as esbuild.BuildInvalidate;

          code_stream.write(`globalThis.$TGV_SOCKET_URL = '${socket_url}';\n`);
          code_stream.write((await banner_promise).outputFiles[1].contents);
          code_stream.write(compute_dep_graph_string(result.metafile));
          fs.createReadStream(`.tgv-cache/${entryPoint}`, 'utf8')
            .pipe(create_cjs_override_transform())
            .pipe(code_stream);

          const included_modules = Object.keys(result.metafile?.inputs ?? {});
          for (const identifier of included_modules) ClientKnownModules.add(identifier);
        } catch (error) {
          ClientKnownModules.clear();
          code_stream.end(`throw new Error('\\n\\n🤷 Build failed, check your terminal');`);
          throw (error as esbuild.BuildFailure).errors;
        }
      },
      /**
       * The payload includes:
       * - Changed modules that are already included in the bundle
       * - Modules that are newly imported by the changed modules (recursively)
       *
       * @param changed_files A list of relative filepaths that have changed since the last build, which may or may not be part of the bundle
       */
      async build_hmr_payload(changed_files: string[]) {
        // It doesn't make sense to hot replace a module that isn't currently included in the bundle
        const modules_to_hot_replace = changed_files.filter(file => ClientKnownModules.has(file));

        // Using the whole list of `changed_files` to do the invalidation, not only the modules to hot replace
        // a module that's not included anymore may get included later
        for (const identifier of changed_files) ClientKnownModules.delete(identifier);

        if (!modules_to_hot_replace.length) return undefined;

        const entry_point_contents = modules_to_hot_replace
          .map(filepath => `import './${filepath}';`)
          .join('\n');

        try {
          const result = await esbuild.build({
            ...base_build_options,
            stdin: {
              contents: entry_point_contents,
              resolveDir: process.cwd(),
              sourcefile: '<hmr-payload>',
            },
            plugins: hmr_plugins,
          });

          const included_modules = without(keys(result.metafile?.inputs), '<hmr-payload>');

          // This will be the modules to replace + the newly included modules if any
          const modules_in_payload = new Set<string>();

          for (const identifier of included_modules) {
            if (ClientKnownModules.has(identifier)) continue;
            modules_in_payload.add(identifier);
            ClientKnownModules.add(identifier);
          }

          const code_payload = `
${compute_dep_graph_string(result.metafile, [...modules_in_payload])}
${override_cjs_helper(result.outputFiles[1].text)}`;

          return {
            modules_to_hot_replace,
            code: code_payload,
            map: result.outputFiles[0].text, // TODO: offset by dep graph string
          };
        } catch (error) {
          for (const identifier of changed_files) ClientKnownModules.add(identifier); // reset
          throw (error as esbuild.BuildFailure).errors;
        }
      },
    };
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
      callback(null, override_cjs_helper(string_content));
    },
  });
}

function override_cjs_helper(bundle_with_runtime: string) {
  return bundle_with_runtime.replace(
    esbuild_helper_regExp,
    'var __commonJS = globalThis.$COMMONJS;\n\n' // line breaks to avoid breaking sourcemaps
  );
}

const esbuild_helper_regExp = /var __commonJS.*\n.*\n\s*};/;

function compute_dep_graph_string(metafile?: esbuild.Metafile, filter?: string[]): string {
  if (!metafile?.inputs) return '';

  const inputs = metafile.inputs;

  const relevant_modules = filter
    ? Object.keys(inputs).filter(identifier => filter.includes(identifier))
    : Object.keys(inputs);

  const as_object = Object.fromEntries(
    relevant_modules.map(key => {
      return [key, inputs[key].imports.map(imp => imp.path)];
    })
  );

  return `globalThis.$UPDATE_MODULE_GRAPH(${JSON.stringify(as_object, null, 2)});`;
}
