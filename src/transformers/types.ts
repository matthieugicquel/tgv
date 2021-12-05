import type * as esbuild from 'esbuild';

export type TransformerFactory = (options: TransformerOptions) => Transformer;

export type Transformer = (data: TransformData) => TransformData;

export type TransformData = {
  code: string;
  map?: string;
  filepath: string;
  loader: 'tsx' | 'ts' | 'jsx' | 'js';
  required_transforms: string[];
};

export type RequiredTransforms =
  | 'imports'
  | 'flow'
  | 'reanimated2'
  | 'react-refresh'
  | 'classes-for-hermes';

export type TransformerOptions = {
  hmr?: boolean;
  hermes?: boolean;
  // TODO: options like "production", JSX pragma, etc
};

/**
 * Trying to use esbuild's error format everywhere in transforms
 */
export type TransformError = esbuild.PartialMessage;
