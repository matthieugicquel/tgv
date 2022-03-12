import { StaticPool } from 'node-worker-threads-pool';
import { cpus } from 'os';
import path from 'path';

import { module_dirname } from '../../utils/path.js';
import { lazy } from '../../utils/utils.js';
import type { TransformData } from './types';

const babel_pool = lazy(() => {
  return new StaticPool({
    // esbuild already uses lots of cpus, using 1/3 seems to be the best for perf
    // This may also be a reason why we don't benefit from more parallelism: https://github.com/evanw/esbuild/issues/111#issuecomment-719910381
    // Anyway, even with a pool size of 1, we would still benefit from the main thread not being blocked for esbuild and swc
    size: Math.round(cpus().length / 3),
    task: path.join(module_dirname(import.meta), './babel.worker.js'),
  });
});

export const babel_with_pool = (input: TransformData): Promise<TransformData> => {
  return babel_pool().exec(input);
};

export async function destroy_worker_pool() {
  await babel_pool().destroy();
}
