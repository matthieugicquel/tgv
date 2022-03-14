import path from 'path';

import { module_dirname } from '../../utils/path.js';
import { TGVPlugin } from '../types.js';

export const reanimated = ({ packages }: { packages: string[] } = { packages: [] }): TGVPlugin => {
  return {
    name: 'reanimated',
    filter: {
      loaders: ['js', 'jsx', 'ts', 'tsx'],
      packages: ['react-native-reanimated', '<app-code>', ...packages],
      contentTest: new RegExp(
        `("worklet"|'worklet'|useAnimatedStyle|useAnimatedProps|createAnimatedPropAdapter|useDerivedValue|useAnimatedScrollHandler|useAnimatedReaction|useWorkletCallback|createWorklet|withTiming|withSpring|withDecay|withRepeat|useAnimatedGestureHandler|useAnimatedScrollHandler)`
      ),
    },

    transform: path.join(module_dirname(import.meta), './reanimated.worker.js'),
  };
};
