import type { TransformerFactory, TransformError } from './types';

export const create_babel_transformer: TransformerFactory = ({ hermes }) => {
  const babel_path = maybe(() =>
    require.resolve('@babel/core', {
      paths: [process.cwd()],
    })
  );

  if (!babel_path) return input => input;

  const reanimated_plugin_path = maybe(() =>
    require.resolve('react-native-reanimated/plugin', {
      paths: [process.cwd()],
    })
  );

  const classes_plugin_path =
    hermes &&
    maybe(() =>
      require.resolve('@babel/plugin-transform-classes', {
        paths: [process.cwd()],
      })
    );

  return input => {
    let plugins: string[] = [];

    if (workletize_RegExp.test(input.code)) {
      if (reanimated_plugin_path) {
        plugins = [...plugins, reanimated_plugin_path];
      } else {
        console.warn('The reanimated babel plugin seems to be missing');
      }
    }

    // Adding this transform significantly increases build time
    // Maybe improve the check or implement it in esbuild or use swc?
    if (hermes && input.code.includes('class ') /* class_RegExp.test(input.code) */) {
      if (classes_plugin_path) {
        plugins = [...plugins, classes_plugin_path];
      } else {
        console.warn('@babel/plugin-transform-classes is necessary for hermes and not installed');
      }
    }

    if (!plugins.length) return input;

    try {
      const result = require(babel_path).transformSync(input.code, {
        plugins,
        configFile: false,
        filename: input.filepath,
        sourceType: 'unambiguous',
      });

      return {
        ...input,
        code: result.code,
      };
    } catch (error) {
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
  '(useAnimatedStyle|useAnimatedProps|createAnimatedPropAdapter|useDerivedValue|useAnimatedScrollHandler|useAnimatedReaction|useWorkletCallback|createWorklet|withTiming|withSpring|withDecay|withRepeat|useAnimatedGestureHandler|useAnimatedScrollHandler)'
);

// const class_RegExp = /class\s(\w+\s|\s||.*extends.*)\{/;

const maybe = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch (error) {
    return undefined;
  }
};

interface BabelError extends Error {
  code: string; // This is an error code
}

const is_babel_error = (error: unknown): error is BabelError => {
  return (error as BabelError).code !== undefined;
};
