import ora from 'ora';
import { performance } from 'perf_hooks';
import type * as esbuild from 'esbuild';
import { logger } from '@react-native-community/cli-tools';
import kleur from 'kleur';
import path from 'path';

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
    spinner.stopAndPersist({
      symbol: kleur.green().bold('success'),
      text: `${message} (${timing}ms)`,
    });

    return result;
  } catch (error) {
    spinner.stopAndPersist({ symbol: kleur.red().bold('error') });
    throw error;
  }
}

export function print_errors(error: unknown) {
  if (is_esbuild_errors(error)) {
    for (const e of error) {
      e.location?.lineText;
      const source = kleur.bold(e.pluginName || 'esbuild');
      const file = e.location?.file ? path.basename(e.location.file) : 'unknown file';
      const loc = kleur.bgRed(`${file}:${e.location?.line || 0}:${e.location?.column || 0}`);
      const line = e.location?.lineText ? `\n\t${kleur.gray(e.location.lineText || '')}` : '';
      logger.error(`${source} ${loc} ${e.text}${line}`);
    }
    return;
  }
  console.error(error);
}

function is_esbuild_errors(error: unknown): error is esbuild.Message[] {
  if (!Array.isArray(error)) return false;
  return error.every(e => 'pluginName' in (e as esbuild.Message));
}
