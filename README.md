# TGV - an experimental faster bundler and dev server for React Native, built on top of esbuild

**⚠️ This will probably not work with your app, and may never, it's an experiment**

Known limitations:

- You'll need a recent React Native version
- May or may not work with latest hermes (0.9 - with RN 0.66), won't work with previous hermes versions
- The compatibility between esbuild's output and React Native's JS runtimes is not clear yet, some JS features may break everything

# Goals

- A dev server that runs all day long without getting in your way. It should handle things like branch switches, `yarn install` smoothly and you should never wait for it
- Fast bundling (a few seconds) so that OTA deploys (codepush, expo...) are fast
- Smaller and faster prod bundles thanks to tree-shaking and ES modules scope-hoisting

# Installation

TGV requires node >= 16.

This package is not yet published to npm.

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
yarn tgv # This starts a dev server that replaces metro, do it before `run-x` so that metro doesn't start automatically
yarn react-native run-(ios|android)
```

## Using as the production bundler

### 🍏 iOS

Add `export BUNDLE_COMMAND=bundle-tgv` to the "Bundle react native code and images" script in Xcode for the app target:

<img width="1397" alt="Add an export BUNDLE_COMMAND=bundle-tgv line to the bundle react native code and images script in Xcode" src="https://user-images.githubusercontent.com/10573690/145253632-f31d50e8-deab-4860-8f6c-4ce9503d8521.png">


### 🤖 Android

```groovy
// android/app/build.gradle

project.ext.react = [
    // ...
    bundleCommand: 'bundle-tgv'
]
```


# Docs

Only this READM for now yet, but some research is here:

- [TODO list](./notes/todo.md)
- [HMR](./notes/hmr.md)
- [metro](./notes/metro.md)
