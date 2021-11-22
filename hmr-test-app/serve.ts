import { start_dev } from '../src/start-dev';
import { createReadStream } from 'fs';

const dir = 'hmr-test-app/www';

(async function () {
  try {
    const server = await start_dev({
      port: 3000,
      entryPoint: 'hmr-test-app/src/index.tsx',
      outdir: dir,
    });

    server.get('/index.html', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      try {
        createReadStream(`${dir}/index.html`, 'utf8').pipe(res);
      } catch (error) {
        console.error(error);
      }
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
