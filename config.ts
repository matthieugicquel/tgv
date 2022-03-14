import type { TGVPlugin } from './src/plugins/types';

export type TGVConfigDef = {
  entryFile?: string;
  serverPort?: number;
  plugins?: TGVPlugin[] | (() => Promise<TGVPlugin[]>);
};
