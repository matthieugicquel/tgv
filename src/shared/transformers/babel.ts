import { lazy, select } from '../../utils/utils';
import type { TransformData, TransformError } from './types';
import type * as babel from '@babel/core';
import type { ParserPlugin } from '@babel/parser';

const babel_core = lazy(() => {
  const babel_path = require.resolve('@babel/core', { paths: [process.cwd()] });
  return require(babel_path) as typeof import('@babel/core');
});

const hermes_classes_plugins = lazy(() => {
  return [babel_core().createConfigItem('@babel/plugin-transform-classes', { type: 'plugin' })];
});

const reanimated_plugins = lazy(() => {
  return [
    // Without transform-block-scoping, `useAnimatedRef` crashes
    babel_core().createConfigItem('@babel/plugin-transform-block-scoping', { type: 'plugin' }),
    babel_core().createConfigItem('react-native-reanimated/plugin', { type: 'plugin' }),
  ];
});

const react_refresh_plugins = lazy(() => {
  return [babel_core().createConfigItem('react-refresh/babel', { type: 'plugin' })];
});

export function babel_transformer(input: TransformData) {
  const plugins: babel.ConfigItem[] = [];

  // Adding this transform significantly increases build time
  // Maybe improve the check or implement it in esbuild or use swc?
  if (input.required_transforms.includes('classes-for-hermes')) {
    try {
      plugins.push(...hermes_classes_plugins());
    } catch (error) {
      console.warn('Babel plugins necessary for hermes seem to be missing', error);
    }
  }

  if (input.required_transforms.includes('reanimated2')) {
    try {
      plugins.push(...reanimated_plugins());
    } catch (error) {
      console.warn('The reanimated babel plugin seems to be necessary and missing', error);
    }
  }

  if (input.required_transforms.includes('react-refresh')) {
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
    const result = babel_core().transformSync(input.code, {
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
    if (!is_babel_error(error)) throw error;

    const formatted_error: TransformError = {
      pluginName: 'babel',
      text: error.message as string,
      location: {
        file: input.filepath,
        line: error.loc.line,
        column: error.loc.column,
      },
    };
    throw formatted_error;
  }
}

interface BabelError extends Error {
  code: string; // This is an error code
  reasonCode: string;
  loc: {
    line: number;
    column: number;
  };
  pos: number;
}

const is_babel_error = (error: unknown): error is BabelError => {
  return (error as BabelError).code === 'BABEL_PARSE_ERROR';
};