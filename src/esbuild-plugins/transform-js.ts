import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { StaticPool } from 'node-worker-threads-pool';
import { cpus } from 'os';
import { compute_hash, create_cache } from '../cache';
import { normalize_path } from '../path-utils';
import { determine_transforms } from '../transformers/determine-transforms';
import { sucrase_transformer } from '../transformers/sucrase';
import { TransformData, TransformerOptions } from '../transformers/types';

export const transform_js_plugin = (): esbuild.Plugin => {
  return {
    name: 'transform-js',
    setup(build) {
      build.onLoad(
        { filter: /.*(js|jsx|ts|tsx)$/ },
        create_js_multitransformer({ hermes: false, hmr: false })
      );
    },
  };
};

export const transform_js_dev_plugin = (): esbuild.Plugin => {
  return {
    name: 'transform-js-dev',
    setup(build) {
      build.onLoad(
        { filter: /.*(js|jsx|ts|tsx)$/ },
        create_js_multitransformer({ hermes: false, hmr: true })
      );
    },
  };
};

export const create_js_multitransformer = (options: TransformerOptions) => {
  type Params = { path: string };
  return async function js_multitransformer(
    params: Params
  ): Promise<esbuild.OnLoadResult | undefined> {
    const relative_path = normalize_path(params.path);

    const loader = (function determine_loader() {
      if (relative_path.endsWith('.ts')) return 'ts';
      if (relative_path.endsWith('.tsx')) return 'tsx';
      if (relative_path.endsWith('.jsx')) return 'jsx';
      if (jsx_in_js_RegExp.test(relative_path)) return 'jsx';
      return 'js';
    })();

    const code = await readFile(relative_path, 'utf8');

    const hash = compute_hash(code);
    const cached = TransformCache.get(relative_path, hash);
    if (cached) return { contents: cached, loader };

    try {
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

      TransformCache.set(relative_path, hash, data.code);
      return { contents: data.code, loader };
    } catch (error) {
      // This is probably an internal, uncontrolled error
      if (!is_transform_error(error)) throw error;

      return { errors: [error as esbuild.PartialMessage] };
    }
  };
};

const TransformCache = create_cache('transform-cache');

const babel_pool = new StaticPool({
  // esbuild already uses lots of cpus, using 1/3 seems to be the best for perf
  size: Math.round(cpus().length / 3),
  task: require.resolve('../transformers/babel-worker'),
});
const babel: (input: TransformData) => Promise<TransformData> = babel_pool.exec;

export async function destroy_worker_pool() {
  await babel_pool.destroy();
}

const is_transform_error = (error: unknown): error is esbuild.PartialMessage => {
  return 'location' in (error as esbuild.PartialMessage);
};

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
