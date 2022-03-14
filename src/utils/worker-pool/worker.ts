import { parentPort } from 'worker_threads';

parentPort?.on('message', async ({ module_path, input }) => {
  const { transform } = await import(module_path);
  const result = transform(input);
  parentPort?.postMessage(result);
});
