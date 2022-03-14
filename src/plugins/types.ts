import type * as esbuild from 'esbuild';

export type TGVPlugin = {
  name: string;
  filter: {
    loaders?: string[];
    packages?: (string | '<app-code>')[];
    contentTest?: RegExp;
  };
  /**
   * Either a transform function or a path to a module that exports a transform function name `transform`.
   * If a path is provided, the transformer will be run in a worker
   */
  transform: TransformFunction | string;
};

export type TransformFunction = (input: PluginData) => PluginData | Promise<PluginData>;

export type PluginData = {
  code: string;
  map?: string;
  loader: string;
  relative_path: string;
  hmr: boolean;
};

export type TGVPluginTransformError = esbuild.PartialMessage;
