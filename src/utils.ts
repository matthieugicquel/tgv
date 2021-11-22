export const pipe =
  <T>(...fns: ((input: T) => T)[]) =>
  (x: T) =>
    fns.reduce((acc, fn) => fn(acc), x);
