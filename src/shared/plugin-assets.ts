import type * as esbuild from 'esbuild';
import { readFile, readdir, copyFile, mkdir } from 'fs/promises';
import image_size from 'image-size';
import { normalize_path } from '../utils/path';
import * as path from 'path';
import { select } from '../utils/utils';
import getAssetDestPathAndroid from './assets/getAssetsDestPathAndroid';
import { logger } from '@react-native-community/cli-tools';

// TODO: support all image types (and maybe other assets?)
export const asset_extensions = ['.png'];

const assets_regExp = new RegExp(`\\.*(${asset_extensions.join('|')})$`);

type AssetPluginOptions = {
  platform: 'ios' | 'android';
  assets_dest?: string;
};

export const assets_plugin = ({ platform, assets_dest }: AssetPluginOptions): esbuild.Plugin => {
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

        // See tests here for exepcted output https://github.com/facebook/react-native/blob/77ecc7ede1da8fc590d7bc238a2fc02daa736746/Libraries/Image/__tests__/resolveAssetSource-test.js
        const asset_location_dir = `/assets/${dir}`;
        const asset: PackagerAsset = {
          __packager_asset: true,
          httpServerLocation: asset_location_dir,
          hash: 'tgv-asset', // TODO, if this is useful
          width: size.width,
          height: size.height,
          name: files[relative_path].name,
          type: files[relative_path].type,
          scales: files[relative_path].scales,
        };

        if (assets_dest) {
          for (const scale of asset.scales.filter(filter_scales(platform))) {
            // TODO: Android
            const dest = select(platform, {
              ios: path.join(
                assets_dest,
                asset_location_dir.replaceAll('..', '_'),
                `${asset.name}${scale === 1 ? '' : `@${scale}x`}.${asset.type}`
              ),
              android: path.join(assets_dest, getAssetDestPathAndroid(asset, scale)),
            });

            logger.info('writing asset to', dest);

            await mkdir(path.dirname(dest), { recursive: true });
            await copyFile(files[relative_path].on_disk_path[scale], dest);
          }
        }

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