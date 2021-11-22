import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { normalize_path } from '../path-utils';
import { create_hmr_transformer } from '../transformers/hmr-wrap';

export const transform_json_dev_plugin = (): esbuild.Plugin => {
  return {
    name: 'transform-json-dev',
    setup(build) {
      build.onLoad({ filter: /.*json$/ }, transform_json_dev);
    },
  };
};

const transform_json_dev = async ({
  path,
}: Pick<esbuild.OnLoadArgs, 'path'>): Promise<esbuild.OnLoadResult | undefined> => {
  const relative_path = normalize_path(path);

  const code = await readFile(relative_path, 'utf8');

  const hmr = create_hmr_transformer({});

  const result = hmr({ code: `module.exports = ${code}`, filepath: relative_path });

  return {
    contents: result.code,
    loader: 'js',
  };
};
