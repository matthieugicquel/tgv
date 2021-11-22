import type { TransformerFactory, TransformError } from './types';
import * as sucrase from 'sucrase';

export const create_sucrase_transformer: TransformerFactory = options => input => {
  // JSX and TS could be handled by esbuild, but sucrase doesn't allow just applying the imports or flow transforms alone
  const transforms: sucrase.Transform[] = input.filepath.endsWith('.js')
    ? ['jsx', 'flow']
    : ['jsx', 'typescript'];

  // For HMR wrapping to work, we need all modules to be transformed to CJS
  // The sucrase 'imports' transform adds "use strict" even when doing nothing, this can cause problems, for instance with react-native-safe-modules (used by lottie)
  // So only apply the transform when necessary
  if (options.hmr && is_esm_RegExp.test(input.code)) transforms.push('imports');

  try {
    const transformed = sucrase.transform(input.code, { transforms });
    return {
      ...input,
      code: transformed.code,
      // TODO: sourcemaps? sucrase preserves line so this isn't critical I think
    };
  } catch (error) {
    if (!is_sucrase_error(error)) throw error;

    const lineText = input.code.split('\n')[error.loc.line - 1];
    const formatted_error: TransformError = {
      pluginName: 'transform-js-sucrase',
      text: error.message as string,
      location: {
        file: input.filepath,
        line: error.loc.line,
        column: error.loc.column,
        length: lineText.length - error.loc.line,
        lineText,
      },
      detail: `transforms: ${transforms.join(',')}`,
    };
    throw formatted_error;
  }
};

interface SucraseError extends Error {
  loc: {
    line: number;
    column: number;
  };
}

const is_sucrase_error = (error: unknown): error is SucraseError => {
  return (error as SucraseError).loc !== undefined;
};

const is_esm_RegExp = /(import|export)[\s\{\*]/;

// It would be better to optimise which transforms are used
// But the react-native ecosystem is a real mess on this topic
// Not sure making all these tests would really help
//
// let necessary_transforms: sucrase.Transform[] = [];

// // For HMR wrapping to work, we need all modules to be transformed to CJS
// // The sucrase 'imports' transform adds "use strict" even when doing nothing, this can cause problems, for instance with react-native-safe-modules (used by lottie)
// // So only apply the transform when necessary
// if (options.hmr && is_esm_RegExp.test(input.code)) necessary_transforms.push('imports');

// // esbuild doesn't transform flow right now
// if (flow_RegExp.test(input.filepath)) necessary_transforms.push('flow');

// let supporting_transforms: sucrase.Transform[] = ['jsx'];

// if (input.filepath.endsWith('.ts') || input.filepath.endsWith('.tsx'))
//   supporting_transforms.push('typescript');

// if (!necessary_transforms.length) return input;

// const transforms = [...necessary_transforms, ...supporting_transforms];

// const PACKAGES_WITH_JSX_IN_JS = [
//   'react-native',
//   '@react-native',
//   'react-native-keyboard-spacer',
//   '@sentry/react-native',
//   'react-native-pdf',
//   'react-native-snap-carousel',
//   'react-native-collapsible',
//   'react-native-webview',
//   'react-native-material-textfield',
//   'react-native-google-places-autocomplete',
//   'react-native-neomorph-shadows',
//   'react-native-swipe-gestures',
//   'react-native-reanimated',
//   'react-native-animatable',
//   'react-native-screens',
//   'react-native-gesture-handler',
//   'react-native-share',
//   '@react-native-community/art',
//   'react-native-code-push',
// ];

// const jsx_in_js_RegExp = new RegExp(`node_modules/(${PACKAGES_WITH_JSX_IN_JS.join('|')})/.*(.js)$`);

// const PACKAGES_WITH_FLOW = [
//   'react-native',
//   '@react-native',
//   'react-native-screens',
//   'react-native-code-push',
//   'react-native-gesture-handler',
//   'react-native-mixpanel',
//   '@react-native-async-storage/async-storage',
//   'react-native-share',
//   'rn-fetch-blob',
//   '@react-native-community/art',
//   'react-native-pdf',
// ];

// const flow_RegExp = new RegExp(`node_modules/(${PACKAGES_WITH_FLOW.join('|')})/.*(.js)$`);
