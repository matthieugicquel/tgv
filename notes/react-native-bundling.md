# Dimensions

### Platform

- It doesn't impact file content/transformation
- It impacts path resolution (`.android.js` extensions)
- It impacts where assets are copied when bundling

### JS Engine

- It only impacts JS transformation

- Hermes doesn't support all of ES6, and esbuild doesn't transpile ES5, so we first transpile everything with SWC in this case
- For JSC, we use the `safari11` target of esbuild, it remains to be seen if everything works with it for old iOS versions
