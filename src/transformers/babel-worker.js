require('esbuild-register');

// Babel gets a worker thread because it's the slowest part of the build.

const { parentPort } = require('worker_threads');

const { babel_transformer } = require('./babel');

parentPort.on('message', input => {
  parentPort.postMessage(babel_transformer(input));
});
