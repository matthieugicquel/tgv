import { writeFile } from 'fs/promises';
import { bundle, bundle_for_hmr } from './build';
import { spin } from './reporter';
import { serve_hmr_socket } from './serve-hmr-socket';
import { create_server } from './serve-http';
import { watch } from './watch';
import crypto from 'crypto';
import * as fs from 'fs';

const MODE: 'HMR' | 'BUNDLE' | 'SERVE-CACHE' = 'HMR';

type Params = {
  port: number;
  entryPoint: string;
};

export async function start_dev({ port, entryPoint }: Params) {
  console.log(`👋 Hello, serving on port ${port}`);

  if (!fs.existsSync('.tgv-cache')) fs.mkdirSync('.tgv-cache');

  const { server, ws_server: hmr_server } = create_server({
    create_ws_server: serve_hmr_socket,
  });

  server.get('/index.bundle', async (req, res) => {
    try {
      if (typeof req.query.platform !== 'string') throw 'Invalid query';
      if (!['ios', 'android'].includes(req.query.platform)) throw 'Unsupported platform';

      if (MODE === 'HMR') {
        const client_id = generate_client_id();

        let hmr: ReturnType<typeof hmr_server.expect_client> | undefined;
        let watcher: ReturnType<typeof watch> | undefined;

        // Do this before sending the response
        hmr = hmr_server.expect_client(client_id, async () => {
          (await watcher)?.unsubscribe();
        });

        const { code, map, metafile, build_for_hmr, included_modules } = await spin(
          `🚀 Bundling ${entryPoint} for ${req.query.platform}`,
          bundle_for_hmr({
            entryPoint,
            client_id,
            port,
            platform: req.query.platform as 'ios' | 'android',
          })
        );

        watcher = watch(process.cwd(), async event => {
          if (!build_for_hmr) {
            return; // We ignore updates that happen during bundling. Is this worth improving?
          }
          if (!included_modules.has(event.path)) {
            // It doesn't make sense to hot replace a module that isn't included in the bundle
            // If it's a new file that gets included later, it will be included when it's imported by an already included module
            return;
          }

          try {
            const { code } = await build_for_hmr(event.path);
            hmr?.send_update(code, event.path);
            console.log(`➡️  Sending ${event.path}`);
          } catch (error) {
            console.log(error);
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(code);

        // TODO: put this behind a flag. It's mostly useful for debugging
        await Promise.allSettled([
          writeFile(`.tgv-cache/${entryPoint}`, code),
          writeFile(`.tgv-cache/${entryPoint}.map`, map),
          writeFile(`.tgv-cache/${entryPoint}.meta.json`, JSON.stringify(metafile, null, 2)),
        ]);
      } else if (MODE === 'BUNDLE') {
        const { code, map, metafile } = await spin(
          `🚀 Bundling ${entryPoint} for ${req.query.platform}`,
          bundle({
            entryPoint,
            platform: req.query.platform as 'ios' | 'android',
          })
        );

        await writeFile(`.tgv-cache/${entryPoint}`, code); // For debug purposes
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(code);

        // TODO: put this behind a flag. It's mostly useful for debugging
        await Promise.allSettled([
          writeFile(`.tgv-cache/${entryPoint}`, code),
          writeFile(`.tgv-cache/${entryPoint}.map`, map),
          writeFile(`.tgv-cache/${entryPoint}.meta.json`, JSON.stringify(metafile, null, 2)),
        ]);
      } /* MODE === 'SERVE-CACHE' */ else {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        fs.createReadStream(`.tgv-cache/${entryPoint}`).pipe(res);
      }
    } catch (error) {
      res.writeHead(500);
      res.end();
      console.error(error);
    }
  });

  server.listen(port);

  // TODO: make sure we cleanup the server even on forced exit

  return server;
}

function generate_client_id() {
  return crypto.randomBytes(8).toString('hex');
}
