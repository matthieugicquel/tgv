export function assert_supported_platform(platform: string): asserts platform is 'ios' | 'android' {
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

export type SupportedPlatform = 'ios' | 'android';
