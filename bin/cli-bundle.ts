import { bundle } from '../src/build';
import { spin } from '../src/reporter';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

(async function () {
  try {
    if (!existsSync('.tgv-cache')) mkdirSync('.tgv-cache');

    const result = await spin('Bundling', bundle({ platform: 'ios', entryPoint: 'index.js' }));

    await Promise.allSettled([
      writeFile('.tgv-cache/index.js', result.code),
      writeFile('.tgv-cache/index.js.map', result.map),
      writeFile('.tgv-cache/index.js.meta.json', JSON.stringify(result.metafile, null, 2)),
    ]);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
