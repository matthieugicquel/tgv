# TGV - an EXPERIMENTAL faster bundler and dev server for React Native

## ⚠️ This will probably not work with your app, and is very incomplete

Known limitations:

- Only tested with React Native 0.63 and React Native 0.66 for now
- May work with latest hermes (0.9 - with RN 0.66), won't work with previous hermes versions
- Production bundles are not optimized, they will be bigger than with metro
- Node >= 16 is required

# Goals

- A dev server that runs all day long without getting in your way. It should handle things like branch switches, `yarn install` smoothly and you should never wait for it
- Fast bundling (a few seconds) so that OTA deploys (codepush, expo...) are fast
- Smaller and faster prod bundles thanks to tree-shaking, ES modules scope-hoisting...
- When this is done, build on top of it to push the React Native DX further

# Installation

This package is not currently published to npm.

```sh
git clone git@github.com:matthieugicquel/tgv.git
cd tgv
yarn
yarn link

cd <the RN repo you want to test it with>
```

Add to package.json:

```json
"devDependencies": {
  "tgv": "file:<path-to-tgv>"
}
```

Add `.tgv-cache` to `.gitignore`


```sh
cd <the RN repo you want to test it with>

yarn link tgv
yarn
```

# Usage

## Dev server
```sh
yarn react-native start-tgv # This starts a dev server that replaces metro, should be done before `run-x`
# TODO: find a way to automatically replace metro
yarn react-native run-(ios|android)
```

# Docs

None yet, but some research is here:

- [TODO list](./notes/todo.md)
- [HMR](./notes/hmr.md)
- [metro](./notes/metro.md)