import type { RequiredTransforms, TransformData, TransformerOptions } from './types';

export function determine_transforms(
  options: TransformerOptions,
  input: TransformData
): RequiredTransforms[] {
  const transforms: RequiredTransforms[] = [];

  const is_app_code = !input.filepath.includes('node_modules/');

  // We need to transform everything to CJS for our HMR hacks to work
  // The sucrase 'imports' transform adds "use strict" even when doing nothing, this can cause problems, for instance with react-native-safe-modules (used by lottie)
  // So only apply the transform when necessary
  if (options.hmr && is_esm_RegExp.test(input.code)) {
    transforms.push('imports');
  }

  // esbuild doesn't transform flow right now
  if ((input.loader === 'jsx' || input.loader === 'js') && flow_RegExp.test(input.filepath)) {
    transforms.push('flow');
  }

  // hermes doesn't fully support classes
  if (options.hermes && input.code.includes('class ')) {
    transforms.push('classes-for-hermes');
  }

  if (
    (is_app_code ||
      input.filepath.includes('react-native-reanimated') ||
      input.filepath.includes('react-native-redash')) &&
    workletize_code_RegExp.test(input.code)
  ) {
    transforms.push('reanimated2');
  }

  if (options.hmr && is_app_code) {
    transforms.push('react-refresh');
  }

  return transforms;
}

const is_esm_RegExp = /export(\s(let|const|function|class|default)|\s?(\*|\{))/; // https://regex101.com/r/qtKiHY/1

const workletize_code_RegExp = new RegExp(
  `("worklet"|'worklet'|useAnimatedStyle|useAnimatedProps|createAnimatedPropAdapter|useDerivedValue|useAnimatedScrollHandler|useAnimatedReaction|useWorkletCallback|createWorklet|withTiming|withSpring|withDecay|withRepeat|useAnimatedGestureHandler|useAnimatedScrollHandler)`
);

const PACKAGES_WITH_FLOW = [
  'react-native',
  '@react-native',
  'react-native-screens',
  'react-native-code-push',
  'react-native-gesture-handler',
  'react-native-mixpanel',
  '@react-native-async-storage/async-storage',
  'react-native-share',
  'rn-fetch-blob',
  '@react-native-community/art',
  'react-native-pdf',
];

const flow_RegExp = new RegExp(`node_modules/(${PACKAGES_WITH_FLOW.join('|')})/.*(.js)$`);
