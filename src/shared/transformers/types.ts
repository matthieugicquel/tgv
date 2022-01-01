import type * as esbuild from 'esbuild';

import type { JSEngine } from '../../utils/platform.js';

export type TransformerFactory = (options: TransformerOptions) => Transformer;

export type Transformer = (data: TransformData) => TransformData;

export type TransformData = {
  code: string;
  map?: string;
  filepath: string;
  loader: 'tsx' | 'ts' | 'jsx' | 'js';
  required_transforms: RequiredTransform[];
};

export type RequiredTransform =
  | 'imports'
  | 'flow'
  | 'reanimated2'
  | 'react-refresh'
  | 'es5-for-hermes';

export type TransformerOptions = {
  hmr?: boolean;
  jsTarget: JSEngine;
};

/**
 * Trying to use esbuild's error format everywhere in transforms
 */
export type TransformError = esbuild.PartialMessage;
