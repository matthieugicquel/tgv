export interface GlobalThis {
  $RefreshReg$: (type: string, id: string) => void;
  $RefreshSig$: () => (type: string) => string;
  $COMMONJS: (callback_obj: { [key: string]: ModuleFn }) => () => any;
  $WRAP_MODULE: (exports: any, module: any, identifier: string, module_fn: ModuleFn) => void;
  $WRAP_MODULE_FOR_REFRESH: (
    exports: any,
    module: any,
    identifier: string,
    module_fn: ModuleFn
  ) => void;
  $REQUIRE_CACHED: (exports: any, module: any, identifier: string) => void;
  globalEvalWithSourceUrl: undefined | ((source: string, url: string) => void);
  $RN_DEV_HOOKS: {
    perform_full_refresh: (reason?: string) => void;
  };
  $IS_INITIALIZED: boolean;
  $REACT_REFRESH: typeof import('react-refresh/runtime');
}

export type ModuleFn = (_exports: any, _module: any) => void;
