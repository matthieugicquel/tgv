import path from 'path';
import { fileURLToPath } from 'url';

export function normalize_path(filepath: string) {
  return path.relative(process.cwd(), filepath);
}

export function module_dirname(meta: ImportMeta) {
  return path.dirname(fileURLToPath(meta.url));
}
