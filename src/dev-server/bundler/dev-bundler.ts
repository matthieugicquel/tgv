import * as esbuild from 'esbuild';
import * as fs from 'fs';
import keys from 'lodash-es/keys.js';
import * as path from 'path';
import { PassThrough, Transform, Writable } from 'stream';

import { TGVConfig } from '../../config.js';
import { compute_esbuild_options } from '../../shared/esbuild-options.js';
import { esbuild_plugin_transform } from '../../shared/esbuild-plugin-transform.js';
import { assets_plugin } from '../../shared/plugin-assets.js';
import { entry_point_plugin } from '../../shared/plugin-entrypoint.js';
import logger from '../../utils/logger.js';
import { module_dirname } from '../../utils/path.js';
import { esbuild_plugin_hmr_bundle } from './esbuild-plugin-hmr-bundle.js';
import { esbuild_plugin_hot_module } from './esbuild-plugin-hot-module.js';

export type DevBundlerParams = Pick<TGVConfig, 'entryFile' | 'platform' | 'plugins'>;

export type DevBundler = ReturnType<typeof create_dev_bundler>;

export function create_dev_bundler({ entryFile, platform, plugins }: DevBundlerParams) {
  const base_build_options = {
    ...compute_esbuild_options({
      platform,
      define: {
        __DEV__: 'true',
      },
    }),
    outdir: `.tgv-cache/${platform}`,
    treeShaking: false, // It could mess with HMR
  };

  const banner_promise = esbuild.build({
    ...base_build_options,
    entryPoints: [path.join(module_dirname(import.meta), '../runtimes/require.runtime.js')],
    nodePaths: [path.join(process.cwd(), 'node_modules')], // To resolve react-refresh to the locally installed package
    plugins: [esbuild_plugin_transform({ plugins, hmr: false })],
  });

  const full_options = {
    ...base_build_options,
    entryPoints: [entryFile],
    // Going through fs is faster than going through esbuild's stdio protocol
    write: true,
    incremental: true,
    plugins: [
      entry_point_plugin(entryFile),
      assets_plugin({ platform }),
      esbuild_plugin_hmr_bundle(plugins),
    ],
  };

  let rebuild: esbuild.BuildInvalidate;

  return function bundler_for_client(socket_url: string) {
    const ClientKnownModules = new Set<string>();

    const hmr_plugins: esbuild.Plugin[] = [
      assets_plugin({ platform }),
      esbuild_plugin_hot_module(ClientKnownModules, plugins),
    ];

    return {
      async build_full_bundle(res_stream: Writable) {
        const code_stream = new PassThrough();
        code_stream.pipe(res_stream);

        if (process.env.DEBUG) {
          const save_stream = fs.createWriteStream('.tgv-cache/latest-bundle.js');
          code_stream.pipe(save_stream);
        }

        try {
          ClientKnownModules.clear();

          const result = rebuild ? await rebuild() : await esbuild.build(full_options);

          rebuild = result.rebuild as esbuild.BuildInvalidate;

          code_stream.write(`globalThis.$TGV_SOCKET_URL = '${socket_url}';\n`);
          code_stream.write((await banner_promise).outputFiles[1].contents);
          code_stream.write(compute_dep_graph_string(result.metafile));
          fs.createReadStream(`${full_options.outdir}/${entryFile}`, 'utf8')
            .pipe(create_cjs_override_transform())
            .pipe(code_stream);

          const included_modules = Object.keys(result.metafile?.inputs ?? {});
          for (const identifier of included_modules) ClientKnownModules.add(identifier);
        } catch (error) {
          ClientKnownModules.clear();
          code_stream.end(`throw new Error('\\n\\n🤷 Build failed, check your terminal');`);

          if ('errors' in (error as esbuild.BuildFailure)) {
            throw (error as esbuild.BuildFailure).errors;
          }
          throw error;
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
          .map(filepath => `require('./${filepath}');`)
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
    final(callback) {
      if (!is_done) {
        logger.error(
          'Failed to replace esbuild helper in bundle. HMR will not work. Are you using the exact right esbuild version?'
        );
      }
      callback();
    },
  });
}

function override_cjs_helper(bundle_with_runtime: string) {
  return bundle_with_runtime.replace(
    esbuild_helper_regExp,
    'var __commonJS = globalThis.$COMMONJS;\n\n' // line breaks to avoid breaking sourcemaps
  );
}

const esbuild_helper_regExp = /var __commonJS.*\n.*\n.*\s*};\n\s*};/;

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
