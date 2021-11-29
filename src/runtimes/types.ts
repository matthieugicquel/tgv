export interface GlobalThis {
  $COMMONJS: $COMMONJS;
  $COMMONJS_HOT: (changed_modules: string[]) => $COMMONJS;
  globalEvalWithSourceUrl: undefined | ((source: string, url: string) => void);
  $REACT_REFRESH: typeof import('react-refresh/runtime');
  $RefreshReg$: (type: string, id: string) => void;
  $RefreshSig$: () => (type: string) => string;
  $RN_DEV_HOOKS: {
    perform_full_refresh: (reason?: string) => void;
  };
}

type $COMMONJS = (callback_obj: { [key: string]: ModuleFn }) => () => any;

export type ModuleFn = (_exports: any, _module: any) => void;
