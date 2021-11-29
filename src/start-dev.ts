import { writeFile } from 'fs/promises';
import { bundle, bundle_for_hmr } from './build';
import { spin } from './reporter';
import { serve_hmr_socket } from './serve-hmr-socket';
import { create_server } from './serve-http';
import { watch } from './watch';
import crypto from 'crypto';
import * as fs from 'fs';
import { logger } from '@react-native-community/cli-tools';

const MODE: 'HMR' | 'BUNDLE' | 'SERVE-CACHE' = 'HMR';

type Params = {
  port: number;
  entryPoint: string;
};

export async function start_dev({ port, entryPoint }: Params) {
  logger.success(`👋 Hello, serving on port ${port}`);

  if (!fs.existsSync('.tgv-cache')) fs.mkdirSync('.tgv-cache');

  const { server, ws_server: hmr_server } = create_server({
    port,
    create_ws_server: serve_hmr_socket,
  });

  server.get('/index.bundle', async function bundle_request(req, res) {
    try {
      if (typeof req.query.platform !== 'string') throw 'Invalid query';
      if (!['ios', 'android'].includes(req.query.platform)) throw 'Unsupported platform';

      if (MODE === 'HMR') {
        const client_id = generate_client_id();

        console.time(`bundle round trip - ${client_id}`);

        res.writeHead(200, { 'Content-Type': 'application/javascript' });

        const { build_for_hmr, included_modules } = await spin(
          `🚀 Bundling ${entryPoint} for ${req.query.platform}`,
          bundle_for_hmr({
            entryPoint,
            client_id,
            port,
            platform: req.query.platform as 'ios' | 'android',
            code_stream: res,
          })
        );

        let watcher: ReturnType<typeof watch> | undefined;

        const hmr = hmr_server.client(client_id, async () => {
          (await watcher)?.unsubscribe();
        });

        watcher = watch(process.cwd(), async changed_files => {
          const relevant_files = changed_files.filter(file => included_modules.has(file));
          if (relevant_files.length === 0) {
            // It doesn't make sense to hot replace a module that isn't included in the bundle
            // If it's a new file that gets included later, it will be included when it's imported by an already included module
            return;
          }

          try {
            const { code } = await build_for_hmr(relevant_files);
            hmr.send_update(code);
            logger.log(
              `HMR - Sending ${relevant_files.length} updated files, incl ${relevant_files[0]}`
            );
            await writeFile(`.tgv-cache/latest-hmr.js`, code);
          } catch (error) {
            console.log(error);
          }
        });
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
