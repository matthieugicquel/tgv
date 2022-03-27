import type * as esbuild from 'esbuild';
import { copyFile, mkdir, readdir, readFile } from 'fs/promises';
import image_size from 'image-size';
import * as path from 'path';

import { create_cached_fn } from '../utils/cached-fn.js';
import logger from '../utils/logger.js';
import { normalize_path } from '../utils/path.js';
import { select } from '../utils/utils.js';
import getAssetDestPathAndroid from './assets-helpers/getAssetsDestPathAndroid.js';

const image_extensions = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'psd', 'tiff'];

export const asset_extensions = [
  ...image_extensions,
  'm4v',
  'mov',
  'mp4',
  'mpeg',
  'mpg',
  'webm',
  'aac',
  'aiff',
  'caf',
  'm4a',
  'mp3',
  'wav',
  'html',
  'pdf',
  'yaml',
  'yml',
  'otf',
  'ttf',
  'zip',
  'db',
];

const assets_regExp = new RegExp(`\\.(${asset_extensions.join('|')})$`);

type AssetPluginOptions = {
  platform: 'ios' | 'android';
  assets_dest?: string;
};

export const assets_plugin = ({ platform, assets_dest }: AssetPluginOptions): esbuild.Plugin => {
  return {
    name: 'assets',
    setup(build) {
      build.onResolve({ filter: assets_regExp }, ({ path: filepath, resolveDir }) => {
        const asset_path = path.resolve(resolveDir, filepath);
        return { path: asset_path, namespace: 'assets' };
      });

      build.onLoad({ filter: /.*/, namespace: 'assets' }, async ({ path: filepath }) => {
        const relative_path = normalize_path(filepath);

        const dir = path.dirname(relative_path);

        const files_list = await readdir(dir);
        const files = await parse_dir_cached(dir, files_list, undefined);

        const size = image_extensions.includes(files[relative_path].type)
          ? image_size(await readFile(relative_path))
          : undefined;

        // See tests here for exepcted output https://github.com/facebook/react-native/blob/77ecc7ede1da8fc590d7bc238a2fc02daa736746/Libraries/Image/__tests__/resolveAssetSource-test.js
        const asset_location_dir = `/assets/${dir}`;
        const asset: PackagerAsset = {
          __packager_asset: true,
          httpServerLocation: asset_location_dir,
          hash: 'tgv-asset', // TODO, if this is useful
          width: size?.width,
          height: size?.height,
          name: files[relative_path].name,
          type: files[relative_path].type,
          scales: files[relative_path].scales,
        };

        if (assets_dest) {
          for (const scale of asset.scales.filter(filter_scales(platform))) {
            const dest = select(platform, {
              ios: path.join(
                assets_dest,
                asset_location_dir.replaceAll('..', '_'),
                `${asset.name}${scale === 1 ? '' : `@${scale}x`}.${asset.type}`
              ),
              android: path.join(assets_dest, getAssetDestPathAndroid(asset, scale)),
            });

            logger.debug('writing asset to', dest);

            await mkdir(path.dirname(dest), { recursive: true });
            await copyFile(files[relative_path].on_disk_path[scale], dest);
          }
        }

        const contents = `
var registerAsset = require('react-native/Libraries/Image/AssetRegistry.js').registerAsset;
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

const parse_dir_cached = create_cached_fn({
  cache_name: 'assets-dirs-cache',
  fn: function parse_dir(dir: string, files: string[]) {
    const files_info = files.map(filename => {
      const on_disk_path = path.join(dir, filename);
      const parsed_path = path.parse(on_disk_path);
      const { name, scale } = parse_basename(parsed_path.name);

      return {
        name,
        scale,
        type: parsed_path.ext.replace('.', ''),
        on_disk_path,
      };
    });

    const assets: {
      [name: string]: Pick<PackagerAsset, 'name' | 'type' | 'scales'> & {
        on_disk_path: { [scale: number]: string };
      };
    } = {};

    for (const info of files_info) {
      const { name, type, scale, on_disk_path } = info;

      const normalized_path = path.join(dir, `${name}.${type}`);

      if (!assets[normalized_path]) {
        assets[normalized_path] = {
          name,
          type,
          scales: [],
          on_disk_path: {},
        };
      }

      assets[normalized_path].scales.push(scale);
      assets[normalized_path].on_disk_path[scale] = on_disk_path;
    }
    return assets;
  },
});

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

const filter_scales = (platform: 'ios' | 'android') => {
  return select(platform, {
    ios: (scale: number) => [1, 2, 3].includes(scale),
    android: () => true,
  });
};

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
