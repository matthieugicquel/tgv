# Bundling

- [x] Platforms (iOS, Android) handling
- [x] Find polyfills in the right place depending on RN version
- [x] Transpile ES features not supported by Hermes (and maybe old iOS?)
- [ ] Prod-compatible assets handling
- [ ] Make sure babel errors look nice
- [ ] Clarify which Android/iOS/Hermes/React Native versions are supported

# HMR/Refresh

- [x] React-Refresh boundary accepting itself, without imports changed
- [x] Check if a file is a refresh boundary
- [ ] Accepting from parent, recursively
- [ ] Figure out what the react-refresh babel plugin does and if it's needed
- [ ] Figure out if non-app code should be registered with react-refresh
- [ ] Generic HMR (not react-refresh)? Is this useful?
- [x] Handle JSON files

- [x] Import not yet in cache added to file (app code or node_modules)
- [ ] Import removed (is this really necessary to handle?)

- [ ] Full reload on refresh failure

# HMR Server

- [x] Send module updates
- [ ] Send full refresh instruction

- [ ] Auto-reconnect?

# Debugging

- [ ] Flipper hermes
- [ ] Chrome DevTools / react-native-debugger (is it necessary?)
- [x] React DevTools standalone
- [ ] React DevTools through flipper
- [ ] Dev-menu inspector (it's broken for now)

- [ ] LogBox stack trace symbolication
- [ ] Working source maps for all debuggers

# RN Integration

- [ ] CLI plugin or at least bundle/start commands with compatible options
- [ ] LoadingView
- [ ] Show console.log in CLI output

# Perf

- [ ] Better assets handling
- [x] In-memory cache for transformers
- [ ] On disk cache? (with parcel's watcher caching mechanism?)
- [ ] The app start seems to be slower than with the metro build

# Node issues

- [x] Problem with lottie-react-native

# Someday

- [ ] react-native-web
- [ ] expo
- [ ] Split bundles
