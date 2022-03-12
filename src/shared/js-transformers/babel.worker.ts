// Babel gets a worker thread because it's the slowest part of the build.

import { parentPort } from 'worker_threads';

import { babel_transformer } from './babel.js';

parentPort?.on('message', input => {
  parentPort?.postMessage(babel_transformer(input));
});
