import { bundle } from '../src/build';
import { spin } from '../src/reporter';
import { existsSync, mkdirSync } from 'fs';
import { destroy_worker_pool } from '../src/esbuild-plugins/transform-js';

(async function () {
  try {
    if (!existsSync('.tgv-cache')) mkdirSync('.tgv-cache');

    await spin('Bundling', bundle({ platform: 'ios', entryPoint: 'index.js' }));

    await destroy_worker_pool();
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
