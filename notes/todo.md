# Bundler

- [x] Platforms (iOS, Android) handling
- [x] Find polyfills in the right place depending on RN version
- [x] Transpile ES features not supported by Hermes (and maybe old iOS?)
- [x] RN CLI plugin for bundling
- [x] Prod-compatible assets handling
- [ ] Clarify which Android/iOS/Hermes/React Native versions are supported
- [ ] Reanimated 2 (working with small patch)

### Error handling

- [x] Have a strategy for readable compile errors
- [ ] Make sure all errors look nice
- [ ] Detect when `yarn install` should be run

# Dev server

- [x] RN CLI plugin for dev server

## Scenarios that should be smooth

- [ ] Switched branches, there are many new files
- [ ] node_modules changed
- [ ] File moved (first the file is moved, then it's imports are updated)

## HMR/Refresh implementation

- [x] React-Refresh boundary accepting itself, without imports changed
- [x] Check if a file is a refresh boundary
- [x] Figure out what the react-refresh babel plugin does and if it's needed (it's neeeded !)
- [x] Handle JSON files
- [x] Accepting from parent, recursively
- [ ] Figure out if non-app code should be registered with react-refresh
- [ ] Generic HMR (not react-refresh)? Is this useful?

- [x] Import not yet in cache added to file (app code or node_modules)


## HMR Server

- [x] Send module updates
- [ ] Send full refresh instruction
- [ ] Show console.log in CLI output?
- [x] Auto-reconnect on start

## Perf

- [x] In-memory cache for transformers
- [ ] On disk cache
   - [x] Basic implementation
   - [ ] Include used packages in cache key

- [ ] Check how this behaves when running for hours/days (memory leaks...)

# DevTools integration / debugging

- [ ] Flipper hermes
- [ ] Chrome DevTools / react-native-debugger (is it necessary?)
- [x] React DevTools standalone
- [x] React DevTools through flipper
- [x] Dev-menu inspector

- [ ] LogBox stack trace symbolication
- [ ] Working source maps for all debuggers

# Internal

- [x] Replace esbuild-register with real build process
- [x] Have only lazy requires in `react-native-config.js` to avoid slowing down the whole CLI
- [ ] Tests

# Specific issues

- [x] Problem with lottie-react-native
- [ ] "node_modules/react-native-reanimated/src/reanimated2/platform-specific/RNRenderer.ts" -> Need to replace export default with export *
- [ ] Sometimes the app only "starts" after clicking in the simulator (does not happen with a metro build)

# Someday

- [ ] react-native-web
- [ ] expo support
- [ ] Be more like vite: faster with dep pre-bundling and lazy requires by default?
- [ ] Split bundles
