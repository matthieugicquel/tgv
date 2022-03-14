import { StaticPool } from 'node-worker-threads-pool';
import { cpus } from 'os';
import path from 'path';

import { module_dirname } from '../path.js';
import { lazy } from '../utils.js';

const pool = lazy(() => {
  return new StaticPool({
    // esbuild already uses lots of cpus, using 1/3 seems to be the best for perf
    // This may also be a reason why we don't benefit from more parallelism: https://github.com/evanw/esbuild/issues/111#issuecomment-719910381
    // Anyway, even with a pool size of 1, we would still benefit from the main thread not being blocked for esbuild and swc
    size: Math.round(cpus().length / 3),
    task: path.join(module_dirname(import.meta), './worker.js'),
  });
});

export function run_in_pool<Input>(module_path: string, input: Input): Promise<Input> {
  return pool().exec({ module_path, input });
}

export async function destroy_worker_pool() {
  await pool().destroy();
}
