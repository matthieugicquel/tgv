import { createHash } from 'crypto';

export const create_cache = () => {
  const map = new Map<string, { hash: string; content: string }>();

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
