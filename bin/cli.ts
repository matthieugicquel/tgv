import { start_dev } from '../src/start-dev';

(async function () {
  try {
    await start_dev({
      port: 8081,
      entryPoint: 'index.js',
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
