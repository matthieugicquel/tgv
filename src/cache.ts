import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { deserialize, serialize } from 'v8';
import { maybe } from './utils';

export const create_cache = (name: string) => {
  const cache_path = path.join(process.cwd(), `.tgv-cache/${name}`);

  const deserialized = maybe(() => {
    // TODO: All relevant deps (packages like react-refrehsh, sucrase...) must be included in the hash
    throw new Error('Disabling caching for now since it does not include all deps');
    return deserialize(readFileSync(cache_path));
  });

  const map = deserialized ?? new Map<string, { hash: string; content: string }>();

  process.once('SIGINT', () => {
    const serialized = serialize(map);
    writeFileSync(cache_path, serialized);
    process.exit(0);
  });

  return {
    get(key: string, hash: string) {
      const cached = map.get(key);
      if (cached && cached.hash === hash) {
        return cached.content;
      }
      return undefined;
    },
    set(key: string, hash: string, content: string) {
      map.set(key, { hash, content });
    },
  };
};

export const compute_hash = (content: string) => {
  return createHash('sha1').update(content).digest('base64');
};
