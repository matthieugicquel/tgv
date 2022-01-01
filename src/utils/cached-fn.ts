import isEqualDeep from 'fast-deep-equal';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { deserialize, serialize } from 'v8';

import { maybe } from './utils.js';

type CachedFnConfig<Input, Output> = {
  cache_name: string;
  /**
   * There can only be one cache entry per key even if the hash is different. This helps manage cache size
   */
  id_keys: (keyof Input)[];
  fn: (input: Input) => Output | Promise<Output>;
};

export function create_cached_fn<Input, Output>(config: CachedFnConfig<Input, Output>) {
  const { cache_name, id_keys, fn } = config;

  const cache_path = path.join(process.cwd(), `.tgv-cache/${cache_name}`);

  const deserialized = maybe(() => {
    // TODO: All relevant deps (packages like react-refresh, sucrase...) should be included in the hash
    return deserialize(readFileSync(cache_path));
  });

  const Cache: TCache<Input, Output> = deserialized ?? new Map();

  function persist_cache() {
    try {
      const serialized = serialize(Cache);
      writeFileSync(cache_path, serialized);
    } catch (error) {
      // Not critical
    }
  }

  process.once('SIGINT', () => {
    persist_cache();
    process.exit(0);
  });

  process.once('exit', () => {
    persist_cache();
  });

  return async function cached_fn(input: Input) {
    const key_string = id_keys.map(key => `${key}-${input[key]}`).join('-');

    const cached = Cache.get(key_string);

    // Hashing the input would make the cache smaller, but is slower
    if (cached && isEqualDeep(cached.input, input)) {
      return cached.result;
    }

    const result = await fn(input);

    Cache.set(key_string, { input, result });

    return result;
  };
}

type TCache<Input, Output> = Map<string, { input: Input; result: Output }>;
