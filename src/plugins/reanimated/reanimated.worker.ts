import type { ParserPlugin } from '@babel/parser';
import { createRequire } from 'module';

import { select } from '../../utils/utils.js';
import type { TGVPluginTransformError, TransformFunction } from '../types';

const require = createRequire(import.meta.url);

const babel_path = require.resolve('@babel/core', { paths: [process.cwd()] });
const babel_core = require(babel_path) as typeof import('@babel/core');

const babel_plugins = [
  babel_core.createConfigItem('@babel/plugin-transform-block-scoping', { type: 'plugin' }),
  babel_core.createConfigItem('react-native-reanimated/plugin', { type: 'plugin' }),
];

export const transform: TransformFunction = input => {
  const parser_plugins: ParserPlugin[] = select(input.loader, {
    ts: ['typescript'],
    tsx: ['typescript', 'jsx'],
    jsx: ['jsx'],
    js: [],
  });

  try {
    const result = babel_core.transformSync(input.code, {
      plugins: babel_plugins,
      parserOpts: {
        plugins: parser_plugins,
      },
      generatorOpts: {
        retainLines: true,
      },
      configFile: false,
      babelrc: false,
      filename: input.relative_path,
      sourceType: 'unambiguous',
    });

    if (!result?.code) throw new Error('babel result is null or incomplete');

    return {
      ...input,
      code: result.code,
    };
  } catch (error) {
    if (!is_babel_error(error)) throw error;

    const error_RegExp = /:\s(.*)\s\(\d+:\d+\)$/m;
    const parsed_message = error_RegExp.exec(error.message)?.[0];

    const lineText = input.code.split('\n')[error.loc.line - 1];

    const formatted_error: TGVPluginTransformError = {
      text: parsed_message || error.message,
      location: {
        line: error.loc.line,
        column: error.loc.column,
        length: lineText.length - error.loc.line,
        lineText,
      },
    };
    throw formatted_error;
  }
};

interface BabelError extends Error {
  message: string;
  code: string; // This is an error code
  reasonCode: string;
  loc: {
    line: number;
    column: number;
  };
  pos: number;
}

const is_babel_error = (error: unknown): error is BabelError => {
  return (error as BabelError).code.startsWith('BABEL_') && 'loc' in (error as BabelError);
};
