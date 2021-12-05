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
const ModuleGraph = create_module_graph();

globalThis.$COMMONJS = (callback_obj: { [key: string]: ModuleFn }) => {
  const identifier = Object.keys(callback_obj)[0];
  const module_fn = callback_obj[identifier];

  ModuleRunCache.set(identifier, module_fn);

  return function __require() {
    return require_inner(identifier);
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
  } finally {
    reset_refresh_registration();
  }
}

globalThis.$UPDATE_MODULE_GRAPH = graph => {
  for (const key in graph) ModuleResultCache.delete(key);
  ModuleGraph.update(graph);
};

export type ModuleGraphT = {
  update: (graph: { [identifier: string]: string[] }) => void;
  get_imports: (identifier: string) => ReadonlySet<string>;
  get_importers: (identifier: string) => ReadonlySet<string>;
};
function create_module_graph(): ModuleGraphT {
  const Graph = new Map<string, ReadonlySet<string>>();

  let InvertedGraph: Map<string, Set<string>> | undefined;

  function invert() {
    InvertedGraph = new Map();

    for (const [importer, imports] of Graph.entries()) {
      for (const import_path of imports) {
        if (!InvertedGraph.has(import_path)) {
          InvertedGraph.set(import_path, new Set());
        }
        InvertedGraph.get(import_path)?.add(importer);
      }
    }
    return InvertedGraph;
  }

  return {
    update(graph) {
      for (const [identifier, imports] of Object.entries(graph)) {
        Graph.set(identifier, new Set(imports));
      }
      invert();
    },
    get_imports(identifier) {
      return Graph.get(identifier) ?? new Set<string>();
    },
    get_importers(identifier) {
      return InvertedGraph?.get(identifier) ?? new Set<string>();
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

globalThis.$PERFORM_REFRESH = (modules_to_replace: string[]) => {
  const boundaries = new Set<string>();
  const modules_to_rerun = new Set<string>();

  function find_refresh_boundaries(identifier: string): boolean {
    modules_to_rerun.add(identifier);

    const _exports = ModuleResultCache.get(identifier)?.exports;

    if (is_refresh_boundary(_exports)) {
      boundaries.add(identifier);
      console.log(`${identifier} is a refresh boundary`);
      return true;
    }

    const importers = ModuleGraph.get_importers(identifier);
    console.log(`${identifier} is not a refresh boundary, importers:`, [...(importers || [])]);

    if (!importers?.size) return false; // We've reached the entry-point (or there's a bug)

    return [...importers].every(importer => find_refresh_boundaries(importer));
  }

  const can_refresh = modules_to_replace.every(identifier => find_refresh_boundaries(identifier));

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
    require_inner(boundary);
  }

  Refresh.performReactRefresh();
};

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
