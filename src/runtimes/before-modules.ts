/*
 * The globals added here called by the wrappers injected around modules for HMR
 * Injected as a banner before any bundled code is executed
 */

import Refresh from 'react-refresh/runtime';
import type { GlobalThis, ModuleFn } from './types';

declare var globalThis: GlobalThis;

// We need to be able to re-run the modules that import the ones that's being replaced
const ModuleRunCache = new Map<string, ModuleFn>();

// And the replacing module need to get a reference to the things it imports
const ModuleResultCache = new Map<string, { exports: any }>();

globalThis.$REACT_REFRESH = Refresh;

globalThis.$WRAP_MODULE = (_exports, _module, identifier, module_fn) => {
  ModuleRunCache.set(identifier, module_fn);

  try {
    module_fn(_exports, _module);
    ModuleResultCache.set(identifier, _module);
  } catch (error) {
    // TODO: Should we save failed modules to the RunCache?
    // TODO: Show a nice error that locates the problem...
    console.error(error);
  }
};

globalThis.$WRAP_MODULE_FOR_REFRESH = (_exports, _module, identifier, module_fn) => {
  ModuleRunCache.set(identifier, module_fn);

  const prevRefreshReg = globalThis.$RefreshReg$;
  const prevRefreshSig = globalThis.$RefreshSig$;
  globalThis.$RefreshReg$ = (type, id) => {
    const fullId = identifier + ' ' + id;
    Refresh.register(type, fullId);
  };
  globalThis.$RefreshSig$ = Refresh.createSignatureFunctionForTransform;

  // TODO: register the exports like here https://github.com/codesandbox/codesandbox-client/commit/b3633367c18b0ac664fd2c4419e8e1c76333b890#diff-d71412e3bb9a81e5f9c8636460b749017342df99770be9077718b41659e7b78aR65

  try {
    // Run the module
    module_fn(_exports, _module);

    // Save the exports to cache
    ModuleResultCache.set(identifier, _module);

    // Register exports with React Refresh
    Refresh.register(_exports, identifier + ' %exports%');

    if (is_object(_exports)) {
      for (const key in _exports) {
        if (is_getter(_exports, key)) continue;
        Refresh.register(_exports[key], `${identifier}%exports%${key}`);
      }
    }

    // Don't try to refresh during initial module load
    if (globalThis.$IS_INITIALIZED) {
      if (is_refresh_boundary(_exports)) Refresh.performReactRefresh();
      else console.warn('Full refresh needed');
      // else if (globalThis.$RN_DEV_HOOKS) globalThis.$RN_DEV_HOOKS.perform_full_refresh();
      // else console.warn('Could not refresh');
    }
  } catch (error) {
    // TODO: Should we save failed modules to the RunCache?
    // TODO: Show a nice error that locates the problem...
    console.error(error);
  } finally {
    globalThis.$RefreshReg$ = prevRefreshReg;
    globalThis.$RefreshSig$ = prevRefreshSig;
  }
};

globalThis.$REQUIRE_CACHED = (_exports, _module, identifier) => {
  const cached_module = ModuleResultCache.get(identifier);
  if (!cached_module) {
    console.error(`Module ${identifier} not found in cache`);

    globalThis.$RN_DEV_HOOKS.perform_full_refresh();
    return;
  }
  assign_properties(_exports, cached_module.exports);
};

globalThis.$RefreshReg$ = () => {};
globalThis.$RefreshSig$ = () => type => type;

/*
 * Utilities
 */

function is_refresh_boundary(_exports: any) {
  // From https://github.com/facebook/metro/blob/18a604fa2ea34241c1a3dc474bc19c709bbaacfd/packages/metro-runtime/src/polyfills/require.js#L833
  if (Refresh.isLikelyComponentType(_exports)) return true;

  if (!is_object(_exports)) return false;

  return Object.keys(_exports).every(key => {
    if (is_getter(_exports, key)) return false;
    return Refresh.isLikelyComponentType(_exports[key]);
  });
}

/**
 * The difference with Object.assign is that it doesn't invoke getters and assign their values, but it copies them
 */
function assign_properties(target: any, ...sources: any[]) {
  sources.forEach(source => {
    let descriptors = Object.keys(source).reduce((descriptors, key) => {
      descriptors[key] = Object.getOwnPropertyDescriptor(source, key);
      return descriptors;
    }, {} as any);

    // By default, Object.assign copies enumerable Symbols, too
    Object.getOwnPropertySymbols(source).forEach(sym => {
      let descriptor = Object.getOwnPropertyDescriptor(source, sym);
      if (descriptor?.enumerable) {
        descriptors[sym] = descriptor;
      }
    });
    Object.defineProperties(target, descriptors);
  });
  return target;
}

function is_object(obj: any) {
  return obj && typeof obj === 'object';
}

function is_getter(obj: any, key: string) {
  if (!obj || typeof obj !== 'object') return false;
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  return desc && desc.get;
}
