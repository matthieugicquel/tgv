import type * as esbuild from 'esbuild';
import { readFile, writeFile } from 'fs/promises';

import { PluginData, TGVPlugin } from '../plugins/types.js';
import { normalize_path } from '../utils/path.js';
import { dedupe } from '../utils/utils.js';
import { run_in_pool } from '../utils/worker-pool/pool.js';

export function esbuild_plugin_transform(options: MultiTransformerOptions): esbuild.Plugin {
  const extensions = dedupe(options.plugins.flatMap(plugin => plugin.filter.loaders ?? []));
  const filter = new RegExp(`\\.(${extensions.join('|')})$`);

  return {
    name: 'tgv:transform',
    setup(build) {
      build.onLoad({ filter }, create_multitransformer(options));
    },
  };
}

export type MultiTransformerOptions = {
  hmr: boolean;
  plugins: TGVPlugin[];
  debugFiles?: string[];
};

export type MultiTransformer = (params: {
  path: string;
}) => Promise<esbuild.OnLoadResult | undefined>;

/**
 * Applies transform plugins & the final swc transpilation to ES5
 */
export function create_multitransformer(options: MultiTransformerOptions): MultiTransformer {
  return async function multitransform_filepath({ path }) {
    const relative_path = normalize_path(path);
    const code_buffer = await readFile(relative_path);

    try {
      return await multitransform({ relative_path, code_buffer, ...options });
    } catch (error) {
      // This is probably an internal, uncontrolled error
      if (!is_transform_error(error)) throw error;
      return { errors: [error as esbuild.PartialMessage] };
    }
  };
}

async function multitransform(
  input: MultiTransformerOptions & { relative_path: string; code_buffer: Buffer }
): Promise<esbuild.OnLoadResult | undefined> {
  const { relative_path, code_buffer, plugins } = input;

  const debug = input.relative_path.includes('constant.ts');

  if (debug) {
    console.log(`DEBUG: writing all transform steps to .tgv-cache for ${relative_path}`);
  }

  const file_extension = relative_path.split('.').pop() ?? 'js';
  let data: PluginData = {
    hmr: input.hmr,
    relative_path,
    loader: file_extension === 'js' ? 'jsx' : file_extension,
    code: code_buffer.toString(),
  };

  for (const plugin of plugins) {
    if (!should_apply_plugin(plugin.filter, data)) continue;

    if (typeof plugin.transform === 'string') {
      data = await run_in_pool(plugin.transform, data);
    } else {
      data = await plugin.transform(data);
    }
    if (debug) writeFile(`.tgv-cache/${plugin.name}.js`, data.code);
  }

  return {
    contents: data.code,
    loader: 'js',
  };
}

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
