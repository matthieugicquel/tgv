import type * as esbuild from 'esbuild';
import { readFile } from 'fs/promises';
import { StaticPool } from 'node-worker-threads-pool';
import { cpus } from 'os';
import { compute_hash, create_cache } from '../cache';
import { normalize_path } from '../path-utils';
import { create_sucrase_transformer } from '../transformers/sucrase';
import { TransformData, TransformerOptions } from '../transformers/types';

const TransformCache = create_cache();

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
  const babel_pool = new StaticPool({
    // esbuild uses lots of cpus, using 1/3 seems to be the best for perf
    size: Math.round(cpus().length / 3),
    task: require.resolve('../transformers/babel-worker'),
    workerData: options,
  });
  const babel = babel_pool.exec;

  const sucrase = create_sucrase_transformer(options);

  type Params = {
    path: string;
  };
  return async function js_multitransformer(
    params: Params
  ): Promise<esbuild.OnLoadResult | undefined> {
    const relative_path = normalize_path(params.path);

    const code = await readFile(relative_path, 'utf8');

    const loader = (function determine_loader() {
      if (relative_path.endsWith('.ts')) return 'ts';
      if (relative_path.endsWith('.tsx')) return 'tsx';
      if (relative_path.endsWith('.jsx')) return 'jsx';
      if (jsx_in_js_RegExp.test(relative_path)) return 'jsx';
      return 'js';
    })();

    const hash = compute_hash(code);
    const cached = TransformCache.get(relative_path, hash);
    if (cached) return { contents: cached, loader };

    const input: TransformData = {
      code,
      filepath: relative_path,
      loader,
      is_app_code: !relative_path.includes('node_modules/'),
    };

    try {
      // ⚠️ The babel reanimated plugin must run before the sucrase imports transform, otherwise it doesn't detect imports
      const babel_result = await babel(input);
      const result = sucrase(babel_result);

      TransformCache.set(relative_path, hash, result.code);
      return { contents: result.code, loader };
    } catch (error) {
      // This is probably an internal, uncontrolled error
      if (!is_transform_error(error)) throw error;

      return { errors: [error as esbuild.PartialMessage] };
    }
  };
};

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
