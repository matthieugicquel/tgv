import type * as esbuild from 'esbuild';
import { readFile, readdir } from 'fs/promises';
import image_size from 'image-size';
import { normalize_path } from '../path-utils';
import * as path from 'path';

// TODO: support all image types (and maybe other assets?)
export const asset_extensions = ['.png'];

const assets_regExp = new RegExp(`\\.*(${asset_extensions.join('|')})$`);

export const assets_plugin = (): esbuild.Plugin => {
  return {
    name: 'assets',
    setup(build) {
      build.onResolve({ filter: assets_regExp }, ({ path, resolveDir }) => {
        const asset_path = require('path').resolve(resolveDir, path);
        return { path: asset_path, namespace: 'assets' };
      });

      build.onLoad({ filter: /.*/, namespace: 'assets' }, async ({ path: filepath }) => {
        const relative_path = normalize_path(filepath);

        const dir = path.dirname(relative_path);

        const files = await parse_dir(dir);

        const size = image_size(await readFile(relative_path));

        const asset: PackagerAsset = {
          __packager_asset: true,
          httpServerLocation: `assets-server/${dir}`,
          hash: 'tgv-asset', // TODO, if this is useful
          width: size.width,
          height: size.height,
          ...files[relative_path],
        };

        const contents = `
const { registerAsset } = require('react-native/Libraries/Image/AssetRegistry.js');

module.exports = registerAsset(${JSON.stringify(asset, null, 2)});
`;

        return {
          contents,
          loader: 'js',
          resolveDir: process.cwd(),
        };
      });
    },
  };
};

async function parse_dir(dir: string) {
  const files = await readdir(dir);

  const files_info = files.map(filename => {
    const parsed_path = path.parse(path.join(dir, filename));
    const { name, scale } = parse_basename(parsed_path.name);

    return {
      name,
      scale,
      type: parsed_path.ext.replace('.', ''),
    };
  });

  const assets: { [name: string]: { name: string; type: string; scales: number[] } } = {};

  for (const info of files_info) {
    const { name, type, scale } = info;

    const normalized_path = path.join(dir, `${name}.${type}`);

    if (!assets[normalized_path]) {
      assets[normalized_path] = {
        name,
        type,
        scales: [],
      };
    }

    assets[normalized_path].scales.push(scale);
  }
  return assets;
}

/**
 * From https://github.com/facebook/metro/blob/9bbe219809c2bdfdb949e825817e2522e099ff9f/packages/metro/src/node-haste/lib/AssetPaths.js
 */
function parse_basename(basename: string) {
  const match = basename.match(asset_base_name_RegExp);

  if (!match) throw new Error(`invalid asset name: ${basename}`);

  const name = match[1];

  if (match[3]) {
    const scale = parseFloat(match[3]);
    if (!Number.isNaN(scale)) {
      return { name, scale };
    }
  }
  return { name, scale: 1 };
}

const asset_base_name_RegExp = /(.+?)(@([\d.]+)x)?$/;

type PackagerAsset = {
  __packager_asset: boolean;
  httpServerLocation: string;
  hash: string;
  width?: number;
  height?: number;
  scales: number[];
  name: string;
  type: string;
};
