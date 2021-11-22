declare module 'react-refresh/runtime' {
  export function injectIntoGlobalHook(global: any): void;
  export function register(type: string, fullId: string): void;
  export function createSignatureFunctionForTransform(): (type: string) => string;
  export function performReactRefresh(): void;
  export function isLikelyComponentType(type: any): boolean;
  export function hasUnrecoverableErrors(): boolean;
}
