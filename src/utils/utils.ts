import { performance } from 'perf_hooks';

export const pipe = <T>(...fns: ((input: T) => T)[]) => {
  return function run_pipe(input: T): T {
    let result = input;
    for (const fn of fns) result = fn(result);
    return result;
  };
};

export const select = <V, T extends string>(input: T, outputs: { [K in T]: V }): V => {
  return outputs[input];
};

export const maybe = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch (error) {
    return undefined;
  }
};

export const lazy = <T>(fn: () => T) => {
  let result: T;
  return function lazy_inner() {
    if (result === undefined) result = fn();
    return result;
  };
};

export const time = async <T>(promise: Promise<T>): Promise<[result: T, duration: number]> => {
  const start = performance.now();
  return [await promise, Math.round(performance.now() - start)];
};
