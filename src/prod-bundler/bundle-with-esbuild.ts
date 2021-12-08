import * as esbuild from 'esbuild';
import { assets_plugin } from '../shared/plugin-assets';
import { entry_point_plugin } from '../shared/plugin-entrypoint';
import { transform_js_plugin } from '../shared/plugin-transform-js';
import { compute_esbuild_options } from '../shared/esbuild-options';

type Params = {
  entryPoint: string;
  platform: 'ios' | 'android';
  outfile?: string;
  assets_dest?: string;
};

export async function bundle(params: Params): Promise<void> {
  const { entryPoint, platform, outfile, assets_dest } = params;

  await esbuild.build({
    ...compute_esbuild_options({
      platform,
      define: {
        __DEV__: 'false',
      },
    }),
    minify: true,
    entryPoints: [entryPoint],
    write: true,
    outfile: outfile ?? '.tgv-cache/index.js',
    plugins: [
      entry_point_plugin(entryPoint),
      assets_plugin({ assets_dest, platform }),
      transform_js_plugin({ hermes: false, hmr: false }),
    ],
  });
}
