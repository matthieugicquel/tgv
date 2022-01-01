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
