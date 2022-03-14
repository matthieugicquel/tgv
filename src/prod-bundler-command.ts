import { existsSync, mkdirSync } from 'fs';

import type { TGVConfigDef } from '../config.js';
import { BundleCLIArgs, compute_config } from './config.js';
import { bundle_for_production } from './prod-bundler/prod-bundler.js';
import { print_errors, spin } from './utils/console.js';
import { destroy_worker_pool } from './utils/worker-pool/pool.js';

export async function tgv_bundle(args: BundleCLIArgs, config_def: TGVConfigDef) {
  const config = compute_config(config_def, args);

  if (!existsSync('.tgv-cache')) mkdirSync('.tgv-cache');

  try {
    await spin(
      `📦 Bundling ${config.entryFile} for ${config.platform}`,
      bundle_for_production({
        platform: config.platform,
        entryPoint: config.entryFile,
        outfile: args.bundleOutput,
        assets_dest: args.assetsDest,
        plugins: config.plugins,
      })
    );
  } catch (error) {
    print_errors(error);
  }

  await destroy_worker_pool();
}
