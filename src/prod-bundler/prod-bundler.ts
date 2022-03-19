import * as esbuild from 'esbuild';

import { TGVPlugin } from '../plugins/types.js';
import { compute_esbuild_options } from '../shared/esbuild-options.js';
import { esbuild_plugin_transform } from '../shared/esbuild-plugin-transform.js';
import { assets_plugin } from '../shared/plugin-assets.js';
import { entry_point_plugin } from '../shared/plugin-entrypoint.js';
import { SupportedPlatform } from '../utils/platform.js';

type Params = {
  entryPoint: string;
  platform: SupportedPlatform;
  outfile?: string;
  assets_dest?: string;
  plugins: TGVPlugin[];
};

export async function bundle_for_production(params: Params): Promise<void> {
  const { entryPoint, platform, outfile, assets_dest, plugins } = params;

  try {
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
        esbuild_plugin_transform({
          hmr: false,
          plugins,
        }),
      ],
    });
  } catch (error) {
    if ('errors' in (error as esbuild.BuildFailure)) {
      throw (error as esbuild.BuildFailure).errors;
    }
    throw error;
  }
}
