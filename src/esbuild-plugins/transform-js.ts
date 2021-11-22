import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { compute_hash, create_cache } from '../cache';
import { normalize_path } from '../path-utils';
import { create_babel_transformer } from '../transformers/babel';
import { create_hmr_transformer } from '../transformers/hmr-wrap';
import { create_sucrase_transformer } from '../transformers/sucrase';
import { pipe } from '../utils';

const TransformCache = create_cache();

export const transform_js_plugin = (): esbuild.Plugin => {
  return {
    name: 'transform-js',
    setup(build) {
      build.onLoad({ filter: /.*(js|jsx|ts|tsx)$/ }, transform_js);
    },
  };
};

export const transform_js = async ({
  path,
}: Pick<esbuild.OnLoadArgs, 'path'>): Promise<esbuild.OnLoadResult | undefined> => {
  const options = { hermes: false, hmr: false };

  const relative_path = normalize_path(path);

  const code = await readFile(relative_path, 'utf8');

  const sucrase = create_sucrase_transformer(options);
  const babel = create_babel_transformer(options);

  try {
    const result = pipe(sucrase, babel)({ code, filepath: relative_path });
    return { contents: result.code, loader: 'js' };
  } catch (error) {
    return { errors: [error as esbuild.PartialMessage] };
  }
};

export const transform_js_dev_plugin = (): esbuild.Plugin => {
  return {
    name: 'transform-js-dev',
    setup(build) {
      build.onLoad({ filter: /.*(js|jsx|ts|tsx)$/ }, transform_js_dev);
    },
  };
};

export const transform_js_dev = async ({
  path,
}: Pick<esbuild.OnLoadArgs, 'path'>): Promise<esbuild.OnLoadResult | undefined> => {
  const options = { hermes: false, hmr: true };

  const relative_path = normalize_path(path);

  const code = await readFile(relative_path, 'utf8');

  const hash = compute_hash(code);
  const cached = TransformCache.get(relative_path, hash);
  if (cached) return { contents: cached, loader: 'js' };

  const sucrase = create_sucrase_transformer(options);
  const babel = create_babel_transformer(options);
  const hmr = create_hmr_transformer(options);

  try {
    const result = pipe(sucrase, babel, hmr)({ code, filepath: relative_path });
    TransformCache.set(relative_path, hash, result.code);
    return { contents: result.code, loader: 'js' };
  } catch (error) {
    // This is probably an internal, uncontrolled error
    if (!is_transform_error(error)) throw error;

    return { errors: [error as esbuild.PartialMessage] };
  }
};

const is_transform_error = (error: unknown): error is esbuild.PartialMessage => {
  return 'location' in (error as esbuild.PartialMessage);
};
