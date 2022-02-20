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
    /**
     * JSX in .jsx files will be handled automatically, but packages that contain JSX in .js files must be specified here
     */
    jsxInJs?: string[];
    reanimated?: string[];
  };
  ios?: {
    /**
     * TGV needs to know which JS engine is used because it will try to produce an optimized bundle with modern JS if it's supported
     */
    jsTarget?: 'jsc' | 'hermes';
  };
  android?: {
    /**
     * TGV needs to know which JS engine is used because it will try to produce an optimized bundle with modern JS if it's supported
     */
    jsTarget?: 'jsc' | 'hermes';
  };
};
