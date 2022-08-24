export type SymbolicatorInput = {
  stack: RawFrame[];
};

export type RawFrame = {
  lineNumber: number | null;
  column: number | null;
  file: string | null;
  arguments?: unknown[];
  methodName: string;
};

export type SymbolicatorOutput = {
  codeFrame: CodeFrame | null;
  stack: ProcessedFrame[];
};

export type ProcessedFrame = RawFrame & {
  collapse: boolean;
};

/**
 * Represents [@babel/core-frame](https://babeljs.io/docs/en/babel-code-frame).
 */
export interface CodeFrame {
  content: string;
  location: {
    row: number;
    column: number;
  };
  fileName: string;
}
