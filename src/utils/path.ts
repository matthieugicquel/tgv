import path from 'path';

export function normalize_path(filepath: string) {
  return path.relative(process.cwd(), filepath);
}
