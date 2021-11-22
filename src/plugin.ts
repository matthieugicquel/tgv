import type { OnLoadArgs, OnLoadOptions, Plugin, OnLoadResult } from 'esbuild';
import type { DynamicPool } from 'node-worker-threads-pool';

type OnLoadCallback = (args: OnLoadArgs) => OnLoadResult | null | undefined;

// TODO: maybe use this parrallelize expensive transforms
export const onLoad_plugin =
  (name: string, options: OnLoadOptions, callback: OnLoadCallback) =>
  (pool: DynamicPool): Plugin => {
    return {
      name,
      setup(build) {
        build.onLoad(options, async args => {
          return pool.exec({
            param: args,
            task: callback,
          });
        });
      },
    };
  };
