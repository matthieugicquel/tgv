import { TGVConfigDef } from '../../config.js';
import { assert_supported_platform, JSEngine, SupportedPlatform } from '../utils/platform.js';
import { dedupe } from '../utils/utils.js';

// keep in sync with commands.js
export type BundleCLIArgs = {
  platform?: string;
  entryFile?: string;
  bundleOutput?: string;
  assetsDest?: string;
};

export type TGVConfig = {
  platform: SupportedPlatform;
  entryFile: string;
  bundleOutput: string;
  assetsDest: string | undefined;
  serverPort: number;
  jsTarget: JSEngine;
  transformPackages: {
    flow: string[];
    jsxInJs: string[];
  };
};

export function compute_config(config: TGVConfigDef, cli_args: BundleCLIArgs): TGVConfig {
  const platform = cli_args.platform || 'ios';
  assert_supported_platform(platform);

  return {
    platform,
    entryFile: config.entryFile || 'index.js',
    bundleOutput: cli_args.bundleOutput || '.tgv-cache/index.js',
    assetsDest: cli_args.assetsDest,
    serverPort: config.serverPort || 8081,
    jsTarget: config[platform]?.jsTarget ?? 'jsc',
    transformPackages: {
      flow: dedupe([...(config.transformPackages?.flow ?? []), ...transform_flow_default]),
      jsxInJs: dedupe([...(config.transformPackages?.jsxInJs ?? []), ...transform_jsx_default]),
    },
  };
}

const transform_flow_default = [
  'react-native',
  '@react-native',
  'react-native-screens',
  'react-native-gesture-handler',
  '@react-native-async-storage/async-storage',
  '@react-native-community/art',
  '@react-native-community/progress-bar-android',
];

const transform_jsx_default = [
  'react-native',
  '@react-native',
  'react-native-reanimated',
  'react-native-screens',
  'react-native-gesture-handler',
  '@react-native-community/art',
  '@react-native-community/progress-bar-android',
];