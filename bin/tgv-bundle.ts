import { tgv_bundle } from '../src/prod-bundler-command';

(async function () {
  try {
    await tgv_bundle(undefined, undefined, {
      platform: 'ios',
      entryFile: 'index.js',
      bundleOutput: '.tgv-cache/index.js',
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
