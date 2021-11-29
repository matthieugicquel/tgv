import { lazy, select } from '../utils';
import type { TransformerFactory, TransformError } from './types';
import type * as babel from '@babel/core';
import type { ParserPlugin } from '@babel/parser';

export const create_babel_transformer: TransformerFactory = ({ hermes }) => {
  const babel = lazy(() => {
    const babel_path = require.resolve('@babel/core', {
      paths: [process.cwd()],
    });
    return require(babel_path) as typeof import('@babel/core');
  });

  const hermes_plugins = lazy(() => {
    return [babel().createConfigItem('@babel/plugin-transform-classes', { type: 'plugin' })];
  });

  const reanimated_plugins = lazy(() => {
    return [
      // Without transform-block-scoping, `useAnimatedRef` crashes
      babel().createConfigItem('@babel/plugin-transform-block-scoping', { type: 'plugin' }),
      babel().createConfigItem('react-native-reanimated/plugin', { type: 'plugin' }),
    ];
  });

  const react_refresh_plugins = lazy(() => {
    return [babel().createConfigItem('react-refresh/babel', { type: 'plugin' })];
  });

  return function babel_transformer(input) {
    const plugins: babel.ConfigItem[] = []; // TODO: type this

    // Adding this transform significantly increases build time
    // Maybe improve the check or implement it in esbuild or use swc?
    if (hermes && input.code.includes('class ') /* class_RegExp.test(input.code) */) {
      try {
        plugins.push(...hermes_plugins());
      } catch (error) {
        console.warn('Babel plugins necessary for hermes seem to be missing', error);
      }
    }

    if (
      (input.is_app_code ||
        input.filepath.includes('react-native-reanimated') ||
        input.filepath.includes('react-native-redash')) &&
      workletize_RegExp.test(input.code)
    ) {
      try {
        plugins.push(...reanimated_plugins());
      } catch (error) {
        console.warn('The reanimated babel plugin seems to be necessary and missing', error);
      }
    }

    if (input.is_app_code) {
      try {
        plugins.push(...react_refresh_plugins());
      } catch (error) {
        console.warn('The react-refresh plugin seems to be missing', error);
      }
    }

    if (!plugins.length) return input;

    // JSX and TS could be handled by esbuild, but sucrase doesn't allow just applying the imports or flow transforms alone
    const parser_plugins: ParserPlugin[] = select(input.loader, {
      ts: ['typescript'],
      tsx: ['typescript', 'jsx'],
      jsx: ['jsx'],
      js: [],
    });

    try {
      const result = babel().transformSync(input.code, {
        plugins: [...plugins],
        parserOpts: {
          plugins: parser_plugins,
        },
        configFile: false,
        babelrc: false,
        filename: input.filepath,
        sourceType: 'unambiguous',
      });

      if (!result?.code) throw new Error('babel result is null or incomplete');

      return {
        ...input,
        code: result.code,
        // TODO: sourcemaps
      };
    } catch (error) {
      console.log(error);

      if (!is_babel_error(error)) throw error;

      const formatted_error: TransformError = {
        pluginName: 'transform-js-babel',
        text: error.message as string,
        location: {
          file: input.filepath,
        },
        detail: `plugins: ${plugins.join(',')}`,
      };
      throw formatted_error;
    }
  };
};

const workletize_RegExp = new RegExp(
  `("worklet"|'worklet'|useAnimatedStyle|useAnimatedProps|createAnimatedPropAdapter|useDerivedValue|useAnimatedScrollHandler|useAnimatedReaction|useWorkletCallback|createWorklet|withTiming|withSpring|withDecay|withRepeat|useAnimatedGestureHandler|useAnimatedScrollHandler)`
);

// const class_RegExp = /class\s(\w+\s|\s||.*extends.*)\{/;

interface BabelError extends Error {
  code: string; // This is an error code
}

const is_babel_error = (error: unknown): error is BabelError => {
  return (error as BabelError).code !== undefined;
};
