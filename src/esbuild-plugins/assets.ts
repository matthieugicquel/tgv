import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { ImageURISource } from 'react-native';
import image_size from 'image-size';

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
        // TODO: a better approach. Including all images in the bundle doesn't scale...
        // Also need to use @2x, @3x, etc.

        const buffer = await readFile(filepath);

        const size = image_size(buffer);

        const asset: ImageURISource = {
          uri: `data:image/png;base64,${buffer.toString('base64')}`,
          width: size.width,
          height: size.height,
        };

        return {
          contents: JSON.stringify(asset),
          loader: 'json',
        };
      });
    },
  };
};

// Will probably want to serve assets from the server in dev
// server.get('/assets', (req, res) => {
//   console.log('asset', req.query);
//   if (!req.query.path || typeof req.query.path !== 'string') {
//     res.writeHead(404);
//     res.end();
//     return;
//   }

//   res.writeHead(200, { 'Content-type': 'image/png' });
//   createReadStream(req.query.path).pipe(res);
// });
