import type * as esbuild from 'esbuild';
import { readFile, writeFile } from 'fs/promises';

import { PluginData, TGVPlugin } from '../plugins/types.js';
import { create_cached_fn } from '../utils/cached-fn.js';
import logger from '../utils/logger.js';
import { normalize_path } from '../utils/path.js';
import { dedupe } from '../utils/utils.js';
import { run_in_pool } from '../utils/worker-pool/pool.js';

export function esbuild_plugin_transform(options: MultiTransformerOptions): esbuild.Plugin {
  const { filter, transform } = create_multitransformer(options);

  return {
    name: 'transform',
    setup(build) {
      build.onLoad({ filter }, transform);
    },
  };
}

export type MultiTransformerOptions = {
  hmr: boolean;
  plugins: TGVPlugin[];
};

type MultiTransformer = {
  filter: RegExp;
  transform: (params: { path: string }) => Promise<esbuild.OnLoadResult | undefined>;
};

/**
 * Applies transform plugins & the final swc transpilation to ES5
 */
export function create_multitransformer(options: MultiTransformerOptions): MultiTransformer {
  const extensions = dedupe(options.plugins.flatMap(plugin => plugin.filter.loaders ?? []));
  const filter = new RegExp(`\\.(${extensions.join('|')})$`);

  async function transform({ path }: { path: string }) {
    const relative_path = normalize_path(path);
    const code_buffer = await readFile(relative_path);

    try {
      return await multitransform_cached(
        { relative_path, hmr: options.hmr },
        code_buffer,
        options.plugins
      );
    } catch (error) {
      // This is probably an internal, uncontrolled error
      if (!is_transform_error(error)) throw error;
      return { errors: [error as esbuild.PartialMessage] };
    }
  }
  return { filter, transform };
}

const multitransform_cached = create_cached_fn<
  { relative_path: string; hmr: boolean },
  Buffer,
  TGVPlugin[],
  Promise<esbuild.OnLoadResult | undefined>
>({
  cache_name: 'transform-cache',
  fn: async function multitransform({ relative_path, hmr }, code_buffer, plugins) {
    const debug = false;

    if (debug) {
      logger.debug(`Writing all transform steps to .tgv-cache for ${relative_path}`);
    }

    const file_extension = relative_path.split('.').pop() ?? 'js';
    let data: PluginData = {
      hmr: hmr,
      relative_path,
      loader: file_extension === 'js' ? 'jsx' : file_extension,
      code: code_buffer.toString(),
    };

    for (const plugin of plugins) {
      if (!should_apply_plugin(plugin.filter, data)) continue;

      if (debug) logger.debug(`Applying plugin ${plugin.name} to ${relative_path}`);

      try {
        if (typeof plugin.transform === 'string') {
          data = await run_in_pool(plugin.transform, data);
        } else {
          data = await plugin.transform(data);
        }
        if (debug) writeFile(`.tgv-cache/${plugin.name}.js`, data.code);
      } catch (error) {
        if (!is_transform_error(error)) throw error;

        const full_error: esbuild.PartialMessage = {
          ...error,
          pluginName: `tgv:${plugin.name}`,
          location: {
            ...error.location,
            file: relative_path,
          },
        };
        throw full_error;
      }
    }

    return {
      contents: data.code,
      /*
       * TypeScript has already been transpiled away by swc, but there's an exception:
       * When a type is re-exported from a module without `export type`, swc doesn't know it's a type and keeps it.
       * Then, for esbuild in JS mode it becomes an import that's missing from the original file, while esbuild in TS mode will correctly ignore it.
       * Example of problematic file: react-native-reanimated/src/reanimated2/animation/index.ts
       * Also, since JSX is already transpiled away too, we don't need to worry about the JSX/TS syntax conflicts here
       */
      loader: 'ts',
    };
  },
});

function should_apply_plugin(filter: TGVPlugin['filter'], data: PluginData) {
  if (filter.loaders && !filter.loaders.includes(data.loader)) {
    return false;
  }

  if (filter.packages && !is_in_matching_package(filter.packages, data.relative_path)) {
    return false;
  }

  if (filter.contentTest && !filter.contentTest.test(data.code)) {
    return false;
  }

  return true;
}

const is_in_matching_package = (packages: string[], identifier: string) => {
  if (!identifier.includes('node_modules/')) {
    return packages.includes('<app-code>');
  }
  return packages.some(package_name => identifier.includes(`node_modules/${package_name}/`));
};

const is_transform_error = (error: unknown): error is esbuild.PartialMessage => {
  return 'location' in (error as esbuild.PartialMessage);
};
