/*
 * The globals added here called by the wrappers injected around modules for HMR
 * Injected as a banner before any bundled code is executed
 */

import Refresh from 'react-refresh/runtime';
import type { GlobalThis, ModuleFn } from './types';

declare var globalThis: GlobalThis;

/*
 * Module registry
 */

// We need to be able to re-run the modules that import the ones that's being replaced
const ModuleRunCache = new Map<string, ModuleFn>();

// And the replacing module need to get a reference to the things it imports
const ModuleResultCache = new Map<string, { exports: any }>();

// And in case the hot-replaced module is not a refresh boundary, we need to walk up the parents tree
const ModuleImportersCache = new Map<string, Set<string>>();

globalThis.$COMMONJS = (callback_obj: { [key: string]: ModuleFn }) => {
  const identifier = Object.keys(callback_obj)[0];
  const module_fn = callback_obj[identifier];

  ModuleRunCache.set(identifier, module_fn);
  ModuleImportersCache.set(identifier, new Set());

  return function __require() {
    const { finalize_dep_graph_registration } = prepare_dep_graph_registration(identifier);
    try {
      return require_inner(identifier);
    } finally {
      finalize_dep_graph_registration();
    }
  };
};

globalThis.$COMMONJS_HOT = (changed_modules: string[]) => {
  return function __commonJS_hot(callback_obj: { [key: string]: ModuleFn }) {
    const identifier = Object.keys(callback_obj)[0];

    if (!changed_modules.includes(identifier)) {
      // This is either a cached module or a module that was bundled with the one we want to hot-replace
      return globalThis.$COMMONJS(callback_obj);
    }

    // This is the module we want to hot-replace
    const module_fn = callback_obj[identifier];

    // Hot reload the module
    // Make sure we do that in the registration fn, not the require call, so that everything is clean when code starts executing, even if there are deps between the changed modules
    ModuleRunCache.set(identifier, module_fn);
    ModuleResultCache.delete(identifier);
    parent_module_id = undefined;

    let has_tried_refreshing = false;

    return function __require_hot() {
      try {
        const _exports = require_inner(identifier);
        if (!has_tried_refreshing) {
          has_tried_refreshing = true;
          maybe_perform_refresh(identifier);
        }
        return _exports;
      } catch (error) {
        console.error(`Hot module ${identifier} errored`, error);
      }
    };
  };
};

function require_inner(identifier: string) {
  if (ModuleResultCache.has(identifier)) {
    return ModuleResultCache.get(identifier)?.exports;
  }

  const module_fn = ModuleRunCache.get(identifier);

  if (typeof module_fn !== 'function') {
    throw new Error(`Module ${identifier} not found in run cache`);
  }

  let _module = { exports: {} };
  // This must be done before running module_fn, or everything (circular dependencies really, I think) breaks
  ModuleResultCache.set(identifier, _module);

  if (identifier.includes('node_modules/')) {
    module_fn(_module.exports, _module);
    return _module.exports;
  }

  // This is app code, we want to register it with fast refresh
  const { conclude_refresh_registration, reset_refresh_registration } =
    prepare_refresh_registration(identifier);
  try {
    module_fn(_module.exports, _module);
    conclude_refresh_registration(_module);
    return _module.exports;
  } catch (error) {
    throw error;
  } finally {
    reset_refresh_registration();
  }
}

let parent_module_id: string | undefined = 'entry-point';

function prepare_dep_graph_registration(identifier: string) {
  const prev_parent_module_id = parent_module_id;
  parent_module_id = identifier;

  return {
    finalize_dep_graph_registration() {
      if (identifier !== prev_parent_module_id && prev_parent_module_id) {
        ModuleImportersCache.get(identifier)?.add(prev_parent_module_id);
      }
      parent_module_id = prev_parent_module_id;
    },
  };
}

/*
 * React Refresh
 */

globalThis.$REACT_REFRESH = Refresh;

globalThis.$RefreshReg$ = () => {};
globalThis.$RefreshSig$ = () => type => type;

function prepare_refresh_registration(identifier: string) {
  const prevRefreshReg = globalThis.$RefreshReg$;
  const prevRefreshSig = globalThis.$RefreshSig$;

  globalThis.$RefreshReg$ = (type, id) => {
    const fullId = identifier + ' ' + id;
    Refresh.register(type, fullId);
  };
  globalThis.$RefreshSig$ = Refresh.createSignatureFunctionForTransform;

  return {
    conclude_refresh_registration(_module: { exports: any }) {
      Refresh.register(_module.exports, identifier + ' %exports%');

      if (is_object(_module.exports)) {
        for (const key in _module.exports) {
          if (is_getter(_module.exports, key)) continue;
          Refresh.register(_module.exports[key], `${identifier}%exports%${key}`);
        }
      }
    },
    reset_refresh_registration() {
      globalThis.$RefreshReg$ = prevRefreshReg;
      globalThis.$RefreshSig$ = prevRefreshSig;
    },
  };
}

function maybe_perform_refresh(hmr_identifier: string) {
  const boundaries = new Set<string>();
  const modules_to_rerun = new Set<string>();

  function find_refresh_boundaries(identifier: string): boolean {
    modules_to_rerun.add(identifier);

    const _exports = ModuleResultCache.get(identifier)?.exports;

    if (is_refresh_boundary(_exports)) {
      boundaries.add(identifier);
      return true;
    }

    const importers = ModuleImportersCache.get(identifier);
    if (!importers?.size) return false; // We've reached the entry-point (or there's a bug)

    return [...importers].every(importer => find_refresh_boundaries(importer));
  }

  const can_refresh = find_refresh_boundaries(hmr_identifier);

  if (!can_refresh) {
    console.warn('Full refresh needed');
    // globalThis.$RN_DEV_HOOKS.perform_full_refresh();
    return;
  }

  console.log('refresh', [...modules_to_rerun], [...boundaries]);

  for (const module_id of modules_to_rerun) {
    ModuleResultCache.delete(module_id);
  }

  for (const boundary of boundaries) {
    parent_module_id = undefined;
    require_inner(boundary);
  }

  Refresh.performReactRefresh();
}

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

function is_object(obj: any) {
  return obj && typeof obj === 'object';
}

function is_getter(obj: any, key: string) {
  if (!obj || typeof obj !== 'object') return false;
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  return desc && desc.get;
}
