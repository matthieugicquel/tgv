import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
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

        const buffer = await readFile(filepath);

        const size = image_size(buffer);

        const parsed = path.parse(relative_path);

        const asset: PackagerAsset = {
          __packager_asset: true,
          hash: 'hello', // TODO
          name: parsed.name,
          type: parsed.ext.replace('.', ''),
          width: size.width,
          height: size.height,
          scales: [1], // TODO
          httpServerLocation: `assets-server/${parsed.dir}`,
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
