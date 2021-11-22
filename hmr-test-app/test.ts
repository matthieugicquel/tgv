import { bundle } from '../src/build';
import { performance } from 'perf_hooks';

(async function () {
  const start = performance.now();
  try {
    await bundle({ entryPoint: 'hmr-test-app/src/index.tsx', outdir: 'hmr-test-app/www' });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
  const end = performance.now();
  console.log(`Bundled in ${(end - start).toFixed(0)}ms`);

  process.exit(0);
})();
