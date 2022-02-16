import { existsSync, mkdirSync } from 'fs';

import type { TGVConfigDef } from '../config.js';
import { bundle } from './prod-bundler/bundle-with-esbuild.js';
import { destroy_worker_pool } from './shared/babel-with-pool.js';
import { BundleCLIArgs, compute_config } from './shared/config.js';
import { print_errors, spin } from './utils/console.js';

export async function tgv_bundle(args: BundleCLIArgs, config_def: TGVConfigDef) {
  const config = compute_config(config_def, args);

  if (!existsSync('.tgv-cache')) mkdirSync('.tgv-cache');

  try {
    await spin(
      `📦 Bundling ${args.entryFile} for ${args.platform} (${config.jsTarget})`,
      bundle({
        platform: config.platform,
        jsTarget: config.jsTarget,
        entryPoint: config.entryFile,
        outfile: args.bundleOutput,
        assets_dest: args.assetsDest,
        transformPackages: config.transformPackages,
      })
    );
  } catch (error) {
    print_errors(error);
  }

  await destroy_worker_pool();
}
