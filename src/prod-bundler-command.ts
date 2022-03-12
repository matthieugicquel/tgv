import { existsSync, mkdirSync } from 'fs';

import type { TGVConfigDef } from '../config.js';
import { BundleCLIArgs, compute_config } from './config.js';
import { bundle_for_production } from './prod-bundler/prod-bundler.js';
import { destroy_worker_pool } from './shared/js-transformers/babel.pool.js';
import { print_errors, spin } from './utils/console.js';

export async function tgv_bundle(args: BundleCLIArgs, config_def: TGVConfigDef) {
  const config = compute_config(config_def, args);

  if (!existsSync('.tgv-cache')) mkdirSync('.tgv-cache');

  try {
    await spin(
      `📦 Bundling ${config.entryFile} for ${config.platform} (${config.jsTarget})`,
      bundle_for_production({
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
