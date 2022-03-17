import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { deserialize, serialize } from 'v8';

import isEqualDeep from '../utils/fast-deep-equal.js';
import { maybe } from './utils.js';

type InputValue = string | Buffer | boolean | Array<InputValue>;
type ValidInput = InputValue | Record<string, InputValue | Record<string, InputValue>>;

type CachedFnConfig<
  KeyData extends ValidInput,
  CachedData extends ValidInput,
  OtherData,
  Output
> = {
  cache_name: string;
  fn: (keyData: KeyData, cachedData: CachedData, otherData: OtherData) => Output | Promise<Output>;
};

type TCache<CachedData extends ValidInput, Output> = Map<
  string,
  { cachedData: CachedData; output: Output }
>;

function create_cached_fn_active<
  KeyData extends ValidInput,
  CachedData extends ValidInput,
  OtherData,
  Output
>(config: CachedFnConfig<KeyData, CachedData, OtherData, Output>) {
  const cache_path = path.join(process.cwd(), `.tgv-cache/${config.cache_name}`);

  const deserialized = maybe(() => {
    // TODO: All relevant deps (packages like react-refresh, sucrase...) should be included in the hash
    return deserialize(readFileSync(cache_path));
  });

  const Cache: TCache<CachedData, Output> = deserialized ?? new Map();

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

  return async function cached_fn(keyData: KeyData, cachedData: CachedData, otherData: OtherData) {
    const key_string = Object.entries(keyData)
      .map(([k, v]) => `${k}-${v}`)
      .join('-');

    const cached = Cache.get(key_string);

    // Hashing the input would make the cache smaller, but is slower
    if (cached && isEqualDeep(cached.cachedData, cachedData)) {
      return cached.output;
    }

    const output = await config.fn(keyData, cachedData, otherData);

    Cache.set(key_string, { cachedData, output });

    return output;
  };
}

function create_cached_fn_inactive<
  KeyData extends ValidInput,
  CachedData extends ValidInput,
  OtherData,
  Output
>(config: CachedFnConfig<KeyData, CachedData, OtherData, Output>) {
  return config.fn;
}

export const create_cached_fn = process.env.NO_CACHE
  ? create_cached_fn_inactive
  : create_cached_fn_active;
