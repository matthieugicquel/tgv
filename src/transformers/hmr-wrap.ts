import type { TransformerFactory } from './types';

export const create_hmr_transformer: TransformerFactory = () => input => {
  const is_app_code = !input.filepath.includes('node_modules');

  const wrapper_name = is_app_code ? '$WRAP_MODULE_FOR_REFRESH' : '$WRAP_MODULE';
  const hmr_prelude = `${wrapper_name}(exports, module, '${input.filepath}', (exports, module) => {`;
  const hmr_postlude = '});';

  return {
    ...input,
    code: `${hmr_prelude}\n${input.code}\n${hmr_postlude}`,
    // TODO: sourcemaps?
  };
};
