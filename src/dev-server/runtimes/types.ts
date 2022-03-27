export interface GlobalThis {
  $COMMONJS: $COMMONJS;
  globalEvalWithSourceUrl: undefined | ((source: string, url: string) => void);
  // https://github.com/facebook/react-native/blob/8bd3edec88148d0ab1f225d2119435681fbbba33/packages/polyfills/error-guard.js
  ErrorUtils: undefined | { reportFatalError: (error: unknown) => void };
  $REACT_REFRESH: typeof import('react-refresh/runtime');
  $RefreshReg$: (type: string, id: string) => void;
  $RefreshSig$: () => (type: string) => string;
  $RN_DEV_HOOKS: {
    perform_full_refresh: (reason?: string) => void;
  };
  $TGV_SOCKET_URL: string;
  $UPDATE_MODULE_GRAPH: (graph: { [identifier: string]: string[] }) => void;
  $PERFORM_REFRESH: (modules_to_replace: string[]) => void;
}

type $COMMONJS = (callback_obj: { [key: string]: ModuleFn }) => () => any;

export type ModuleFn = (_exports: any, _module: any) => void;
