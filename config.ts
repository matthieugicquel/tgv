import type { TGVPlugin } from './src/plugins/types';

export type TGVConfigDef = {
  entryFile?: string;
  serverPort?: number;
  /**
   * Packages in the React Native ecosystem sometimes get shipped untranspiled with flow types or JSX inside .js files
   * To avoid lots of slow and useless work, TGV needs to know which of these packages you use to apply these transforms
   * In the long term, one can hope that all packages will be shipped with these transforms already applied and these options become useless
   */
  transformPackages?: {
    flow?: string[];
    reanimated?: string[];
  };
  plugins: TGVPlugin[];
};
