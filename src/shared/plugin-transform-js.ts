import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { StaticPool } from 'node-worker-threads-pool';
import { cpus } from 'os';
import { create_cached_fn } from '../utils/cached-fn';
import { normalize_path } from '../utils/path';
import { determine_transforms } from './transformers/determine-transforms';
import { sucrase_transformer } from './transformers/sucrase';
import { TransformData, TransformerOptions } from './transformers/types';
import { lazy } from '../utils/utils';

export const transform_js_plugin = (options: TransformerOptions): esbuild.Plugin => {
  return {
    name: 'transform-js',
    setup(build) {
      build.onLoad({ filter: /.*(js|jsx|ts|tsx)$/ }, create_js_multitransformer(options));
    },
  };
};

export const create_js_multitransformer = (options: TransformerOptions) => {
  return async function js_multitransformer(params: { path: string }) {
    const relative_path = normalize_path(params.path);
    const code = await readFile(relative_path, 'utf8');

    try {
      return await js_multitransformer_cached({ relative_path, code, ...options });
    } catch (error) {
      // This is probably an internal, uncontrolled error
      if (!is_transform_error(error)) throw error;
      return { errors: [error as esbuild.PartialMessage] };
    }
  };
};

const js_multitransformer_cached = create_cached_fn({
  cache_name: 'transform-cache',
  id_keys: ['relative_path', 'hmr', 'hermes'],
  fn: async function transform(
    input: TransformerOptions & { relative_path: string; code: string }
  ): Promise<esbuild.OnLoadResult | undefined> {
    const { relative_path, code, ...options } = input;

    const loader = determine_loader(relative_path);

    let data: TransformData = {
      code,
      filepath: relative_path,
      loader,
      required_transforms: [],
    };

    data.required_transforms = determine_transforms(options, data);

    // ⚠️ The babel reanimated plugin must run before the sucrase imports transform, otherwise it doesn't detect imports
    if (
      data.required_transforms.includes('reanimated2') ||
      data.required_transforms.includes('react-refresh') ||
      data.required_transforms.includes('classes-for-hermes')
    ) {
      data = await babel(data);
    }

    data = sucrase_transformer(data);

    return { contents: data.code, loader };
  },
});

const babel_pool = lazy(
  () =>
    new StaticPool({
      // esbuild already uses lots of cpus, using 1/3 seems to be the best for perf
      size: Math.round(cpus().length / 3),
      task: require.resolve('./transformers/babel.worker'),
    })
);

const babel: (input: TransformData) => Promise<TransformData> = input => babel_pool().exec(input);

export async function destroy_worker_pool() {
  await babel_pool().destroy();
}

const is_transform_error = (error: unknown): error is esbuild.PartialMessage => {
  return 'location' in (error as esbuild.PartialMessage);
};

function determine_loader(path: string): 'ts' | 'tsx' | 'js' | 'jsx' {
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.jsx')) return 'jsx';
  if (jsx_in_js_RegExp.test(path)) return 'jsx';
  return 'js';
}

const PACKAGES_WITH_JSX_IN_JS = [
  'react-native',
  '@react-native',
  'react-native-keyboard-spacer',
  '@sentry/react-native',
  'react-native-pdf',
  'react-native-snap-carousel',
  'react-native-collapsible',
  'react-native-webview',
  'react-native-material-textfield',
  'react-native-google-places-autocomplete',
  'react-native-neomorph-shadows',
  'react-native-swipe-gestures',
  'react-native-reanimated',
  'react-native-animatable',
  'react-native-screens',
  'react-native-gesture-handler',
  'react-native-share',
  '@react-native-community/art',
  'react-native-code-push',
];

const jsx_in_js_RegExp = new RegExp(`node_modules/(${PACKAGES_WITH_JSX_IN_JS.join('|')})/.*(.js)$`);
