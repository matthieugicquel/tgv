import type ParcelSourceMap from '@parcel/source-map';
import parcel_source_map from '@parcel/source-map';
import { readFileSync } from 'fs';

import logger from '../../utils/logger.js';
import type { ProcessedFrame, RawFrame, SymbolicatorOutput } from './types';

export function create_symbolicator() {
  let current_offset = 0; // For some reason we need to start at -1
  // @ts-expect-error Something wrong with es/cjs interop here
  const sourcemap = new parcel_source_map.default(process.cwd()) as ParcelSourceMap;

  return {
    offset(offset: number) {
      current_offset += offset;
    },
    includeBundle(bundle_path: string) {
      logger.debug(`Including sourcemap ${bundle_path}.map (offset: ${current_offset})`);
      const file = readFileSync(`${bundle_path}.map`, 'utf8');
      const bundle_map = JSON.parse(file);

      sourcemap.addVLQMap(bundle_map, current_offset); // For some reason, the offset is off by 1
    },

    processStackTrace(rawStack: RawFrame[]): SymbolicatorOutput {
      const stack: ProcessedFrame[] = rawStack.map(rawFrame => {
        const mapping = sourcemap.findClosestMapping(
          rawFrame.lineNumber ?? 0,
          rawFrame.column ?? 0
        );

        if (mapping?.original) {
          return {
            lineNumber: mapping.original.line,
            column: mapping.original.column,
            file: mapping.source ?? rawFrame.file ?? '<unknown file>',
            methodName: mapping.name ?? rawFrame.methodName ?? '<unknown method>',
            collapse: false,
          };
        }

        return {
          ...rawFrame,
          collapse: false,
        };
      });

      return {
        codeFrame: null,
        stack,
      };
    },
  };
}
