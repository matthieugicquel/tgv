require('esbuild-register');

// Babel gets a worker thread because it's the slowest part of the build.

const { parentPort, workerData: options } = require('worker_threads');

const babel = require('./babel').create_babel_transformer(options);

parentPort.on('message', input => {
  parentPort.postMessage(babel(input));
});
