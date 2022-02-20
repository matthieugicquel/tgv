import { without } from 'lodash-es';

import type { RequiredTransform, TransformData, TransformerOptions } from './types';

export function determine_transforms(
  options: TransformerOptions,
  input: TransformData
): RequiredTransform[] {
  const transforms: RequiredTransform[] = [];

  const is_app_code = !input.filepath.includes('node_modules/');

  // We need to transform everything to CJS for our HMR hacks to work
  // The sucrase 'imports' transform adds "use strict" even when doing nothing, this can cause problems, for instance with react-native-safe-modules (used by lottie)
  // So only apply the transform when necessary
  // TODO: maybe have custom build of esbuild or get a PR merged for a "wrap each module" output format. This is the main blocker for HMR
  if (options.hmr && is_esm_RegExp.test(input.code)) {
    transforms.push('imports');
  }

  // esbuild doesn't transform flow
  if (
    (input.loader === 'jsx' || input.loader === 'js') &&
    flow_RegExp(options.transformPackages.flow).test(input.filepath)
  ) {
    transforms.push('flow');
  }

  // hermes doesn't fully support classes, esbuild doesn't transform them.
  if (options.jsTarget === 'hermes') {
    transforms.push('es5-for-hermes');
  }

  if (
    (is_app_code ||
      reanimated_package_RegExp(options.transformPackages.reanimated).test(input.filepath)) &&
    workletize_code_RegExp.test(input.code)
  ) {
    transforms.push('reanimated2');
  }

  if (options.hmr && is_app_code) {
    transforms.push('react-refresh');
  }

  return transforms;
}

export function adjust_transforms_from_file_contents(input: TransformData): TransformData {
  let transforms = [...input.required_transforms];

  if (input.required_transforms.includes('reanimated2')) {
    // esbuild doesn't transform flow
    if (!workletize_code_RegExp.test(input.code)) {
      transforms = without(transforms, 'reanimated2');
    }
  }

  if (input.required_transforms.includes('imports')) {
    // esbuild doesn't transform flow
    if (!is_esm_RegExp.test(input.code)) {
      transforms = without(transforms, 'imports');
    }
  }

  return {
    ...input,
    required_transforms: transforms,
  };
}

const is_esm_RegExp = /export(\s(let|const|function|class|default|var)|\s?(\*|\{))/; // https://regex101.com/r/qtKiHY/1

const workletize_code_RegExp = new RegExp(
  `("worklet"|'worklet'|useAnimatedStyle|useAnimatedProps|createAnimatedPropAdapter|useDerivedValue|useAnimatedScrollHandler|useAnimatedReaction|useWorkletCallback|createWorklet|withTiming|withSpring|withDecay|withRepeat|useAnimatedGestureHandler|useAnimatedScrollHandler)`
);

const flow_RegExp = (packages: string[]) => {
  return new RegExp(`node_modules/(${packages.join('|')})/.*(.js)$`);
};

const reanimated_package_RegExp = (packages: string[]) => {
  return new RegExp(`node_modules/(${packages.join('|')})/`);
};
