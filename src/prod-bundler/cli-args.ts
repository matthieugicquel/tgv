/**
 * Trying to maintain compatibility with:
 * 🍏 iOS: https://github.com/facebook/react-native/blob/66243271a7a52fa197d5320f7468c8ea7193c0d3/scripts/react-native-xcode.sh#L155-L164
 * 🤖 Android: https://github.com/facebook/react-native/blob/0f39a1076dc154995a2db79352adc36452f46210/react.gradle#L211
 * Original typedefs are here https://github.com/react-native-community/cli/blob/master/packages/cli-plugin-metro/src/commands/bundle/bundleCommandLineArgs.ts
 */
export interface BundleCLIArgs {
  entryFile: string;
  platform: string;
  bundleOutput: string;
  assetsDest?: string;
}

export const bundle_cli_args = [
  {
    name: '--entry-file <path>',
    description: 'Path to the root JS file, either absolute or relative to JS root',
    default: 'index.js',
  },
  {
    name: '--platform <string>',
    description: 'Either "ios" or "android"',
    default: 'ios',
  },
  {
    name: '--bundle-output <string>',
    description: 'File name where to store the resulting bundle, ex. /tmp/groups.bundle',
    default: '.tgv-cache/index.js',
  },
  {
    name: '--assets-dest <string>',
    description: 'Directory name where to store assets referenced in the bundle',
  },
  // unsupported options that are here for compatibility the react-native scripts
  {
    name: '--dev [boolean]',
    description: 'unsuppported',
  },
  {
    name: '--reset-cache [boolean]',
    description: 'unsuppported',
  },
  {
    name: '--sourcemap-output <string>',
    description: 'unsuppported',
  },
];
