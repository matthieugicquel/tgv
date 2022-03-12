import * as esbuild from 'esbuild';

import { TGVConfig } from '../config.js';
import { compute_esbuild_options } from '../shared/esbuild-options.js';
import { assets_plugin } from '../shared/plugin-assets.js';
import { entry_point_plugin } from '../shared/plugin-entrypoint.js';
import { transform_js_plugin } from '../shared/plugin-transform-js.js';
import { svg_plugin } from '../shared/plugin-transform-svg.js';
import { SupportedPlatform } from '../utils/platform.js';

type Params = {
  entryPoint: string;
  platform: SupportedPlatform;
  outfile?: string;
  assets_dest?: string;
  transformPackages: TGVConfig['transformPackages'];
};

export async function bundle_for_production(params: Params): Promise<void> {
  const { entryPoint, platform, outfile, assets_dest, transformPackages } = params;

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
        svg_plugin({ hmr: false, transformPackages }),
        transform_js_plugin({ hmr: false, transformPackages }),
      ],
    });
  } catch (error) {
    if ('errors' in (error as esbuild.BuildFailure)) {
      throw (error as esbuild.BuildFailure).errors;
    }
    throw error;
  }
}
