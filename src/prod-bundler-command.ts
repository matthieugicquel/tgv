import { existsSync, mkdirSync } from 'fs';
import { destroy_worker_pool } from './shared/plugin-transform-js';
import { assert_supported_platform } from './utils/platform';
import { spin } from './utils/console';
import { BundleCLIArgs } from './prod-bundler/cli-args';
import { bundle } from './prod-bundler/bundle-with-esbuild';

export async function tgv_bundle(_: unknown, _config: unknown, args: BundleCLIArgs) {
  assert_supported_platform(args.platform);

  if (!existsSync('.tgv-cache')) mkdirSync('.tgv-cache');

  await spin(
    `📦 Bundling ${args.entryFile} for ${args.platform}`,
    bundle({
      platform: args.platform,
      entryPoint: args.entryFile,
      outfile: args.bundleOutput,
      assets_dest: args.assetsDest,
    })
  );

  await destroy_worker_pool();
}
