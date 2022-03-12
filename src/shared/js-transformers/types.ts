import type * as esbuild from 'esbuild';

import { TGVConfig } from '../../config.js';
import type { JSEngine } from '../../utils/platform.js';

export type TransformerFactory = (options: TransformerOptions) => Transformer;

export type Transformer = (data: TransformData) => TransformData;

export type Loader = 'js' | 'jsx' | 'ts' | 'tsx';

export type TransformData = {
  code: string;
  map?: string;
  filepath: string;
  loader: Loader;
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
  transformPackages: TGVConfig['transformPackages'];
  debugFiles?: string[];
};

/**
 * Trying to use esbuild's error format everywhere in transforms
 */
export type TransformError = esbuild.PartialMessage;
