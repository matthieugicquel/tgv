# Resources

https://github.com/evanw/esbuild/issues/645 with some ideas

https://github.com/facebook/react/issues/16604#issuecomment-528663101 details about implementing fast refresh

https://maheshsenniappan.medium.com/creating-a-module-bundler-with-hot-module-replacement-b439f0cc660f

https://github.com/snowpackjs/esm-hmr

https://blog.nativescript.org/deep-dive-into-hot-module-replacement-with-webpack-part-two-handling-updates/


# What happens when hot reloading?

- A modules changes
- A file watcher detects it
- Receive it from websocket
- Run it with `eval` or equivalent
- Did it call module.hot.accept()?
  - Yes -> just update the cache to make sure when it's imported in the future, the new version is used
  - No -> re-run the parent, check if it accepts 🔁

Key: We need a module cache, to be able to re-run modules on demand


# HMR with esbuild

It seems there were some experiments

https://github.com/evanw/esbuild/issues/645#issuecomment-797143417
https://github.com/progrium/hotweb/blob/master/pkg/jsexports/jsexports.go

https://github.com/expo/expo-cli/pull/3659

# Module wrapping

```ts
// An alternative to the current wrappers injected with a build plugin: overriding the esbuild __commonJS wrapper function
// Not used right now
globalThis.$REQUIRE = (callback_obj: { [key: string]: ModuleFn }) => () => {
  const identifier = Object.keys(callback_obj)[0];

  if (ModuleResultCache.has(identifier)) {
    return ModuleResultCache.get(identifier)?.exports;
  }

  const module_fn = callback_obj[identifier];
  const _module = { exports: {} };
  try {
    module_fn(_module.exports, _module);
    ModuleRunCache.set(identifier, module_fn);
    ModuleResultCache.set(identifier, _module);
  } catch (error) {
    console.error(error);
  }
  return _module.exports;
};
```
