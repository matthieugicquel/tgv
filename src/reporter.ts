import ora from 'ora';
import { performance } from 'perf_hooks';

/**
 * Show a spinner while waiting for a promise to resolve
 * The spinner will be persisted with ✔ or ✘ depending on the promise result
 * @param message Text that will be shown along the spinner
 * @param promise A promise that, while resolving, does not output anything to stdout
 * @example await spin("Loading some data ", load_data_async())
 */
export async function spin<T>(message: string, promise: Promise<T>): Promise<T> {
  const start = performance.now();
  const spinner = ora(message).start();
  try {
    const result: T = await promise;
    const timing = (performance.now() - start).toFixed(0);
    spinner.succeed(`${message} (${timing}ms)`);
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
