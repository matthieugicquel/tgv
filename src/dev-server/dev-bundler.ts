import * as esbuild from 'esbuild';
import * as fs from 'fs';
import keys from 'lodash-es/keys';
import * as path from 'path';
import { Transform, Writable } from 'stream';
import { assets_plugin } from '../shared/plugin-assets';
import { entry_point_plugin } from '../shared/plugin-entrypoint';
import { hot_module_plugin } from './plugin-hot-module';
import { inject_runtime_plugin } from './plugin-inject-runtime';
import { transform_js_plugin } from '../shared/plugin-transform-js';
import { compute_esbuild_options } from '../shared/esbuild-options';

export type BundlerParams = {
  entryPoint: string;
  platform: 'ios' | 'android';
};

export type DevBundler = ReturnType<typeof create_dev_bundler>;

export function create_dev_bundler({ entryPoint, platform }: BundlerParams) {
  const base_build_options = {
    ...compute_esbuild_options({
      platform,
      define: {
        __DEV__: 'true',
      },
    }),
    outdir: '.tgv-cache',
    treeShaking: false, // It could mess with HMR
  };

  const banner_promise = esbuild.build({
    ...base_build_options,
    entryPoints: [path.join(__dirname, 'runtimes/require.runtime.ts')],
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
      assets_plugin({ platform }),
      inject_runtime_plugin(),
      transform_js_plugin({ hermes: false, hmr: true }),
    ],
  };

  let rebuild: esbuild.BuildInvalidate;

  return function bundler_for_client(socket_url: string) {
    const ClientKnownModules = new Set<string>();

    const hmr_plugins: esbuild.Plugin[] = [
      assets_plugin({ platform }),
      hot_module_plugin(ClientKnownModules),
    ];

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

          // This will be the modules to replace + the newly included modules if any
          const modules_in_payload = new Set<string>();

          for (const identifier of keys(result.metafile?.inputs)) {
            if (identifier === '<hmr-payload>') continue;
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
