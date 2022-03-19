import { TGVConfigDef } from '../config.js';
import { swc } from './plugins/swc/swc.js';
import { TGVPlugin } from './plugins/types.js';
import { assert_supported_platform, SupportedPlatform } from './utils/platform.js';

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
  plugins: TGVPlugin[];
};

export async function compute_config(
  config: TGVConfigDef,
  cli_args: BundleCLIArgs
): Promise<TGVConfig> {
  const platform = cli_args.platform || 'ios';
  assert_supported_platform(platform);

  const user_plugins = await (async () => {
    if (!config.plugins) return [];
    if (Array.isArray(config.plugins)) return config.plugins;
    return await config.plugins();
  })();

  return {
    platform,
    entryFile: config.entryFile || 'index.js',
    bundleOutput: cli_args.bundleOutput || '.tgv-cache/index.js',
    assetsDest: cli_args.assetsDest,
    serverPort: config.serverPort || 8081,
    plugins: [...user_plugins],
  };
}

const tempFlow = [
  'react-native-fs',
  'react-native-fbsdk-next',
  '@react-native-community/push-notification-ios',
  '@react-native-community/picker',
  '@react-native-community/cameraroll',
  '@react-native-community/blur',
  '@react-native-community/async-storage',
  '@react-native-community/datetimepicker',
  '@react-native-firebase/database',
  'react-native-keyboard-aware-scroll-view',
  'react-native-linear-gradient',
  'react-native-animate-number',
  'react-native-camera',
  'react-native-popover-tooltip',
  'react-native-video',
  'react-native-modal-datetime-picker',
  'react-native-share',
];

const tempReanimated = [
  'react-native-redash',
  'stream-chat-react-native-core',
  'react-native-skeleton-content-nonexpo',
  '@gorhom/bottom-sheet',
];
