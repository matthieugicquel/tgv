import { readFileSync, writeFileSync } from 'fs';
import { isEqual } from 'lodash';
import * as path from 'path';
import { deserialize, serialize } from 'v8';
import { maybe } from './utils';

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

  process.once('SIGINT', () => {
    const serialized = serialize(Cache);
    writeFileSync(cache_path, serialized);
    process.exit(0);
  });

  return async function cached_fn(input: Input) {
    const key_string = id_keys.map(key => `${key}-${input[key]}`).join('-');

    const cached = Cache.get(key_string);

    // Hashing the input would make the cache smaller, but is slower
    if (cached && isEqual(cached.input, input)) {
      return cached.result;
    }

    const result = await fn(input);

    Cache.set(key_string, { input, result });

    return result;
  };
}

type TCache<Input, Output> = Map<string, { input: Input; result: Output }>;
