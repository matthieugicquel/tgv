import crypto from 'crypto';
import * as fs from 'fs';
import { writeFile } from 'fs/promises';

import type { TGVConfigDef } from '../config.js';
import { compute_config } from './config.js';
import {
  create_dev_bundler,
  DevBundler,
  DevBundlerParams,
} from './dev-server/bundler/dev-bundler.js';
import { create_hmr_wss } from './dev-server/server/hmr-wss.js';
import { create_http_server } from './dev-server/server/http-server.js';
import { print_errors, spin } from './utils/console.js';
import { watch_fs } from './utils/fs-watcher.js';
import logger from './utils/logger.js';
import { time } from './utils/utils.js';

export async function tgv_start(config_def: TGVConfigDef) {
  const { serverPort } = await compute_config(config_def, {});

  if (!fs.existsSync('.tgv-cache')) fs.mkdirSync('.tgv-cache');

  const { server, attach_wss } = create_http_server(serverPort);

  server.get('/index.bundle', async function bundle_request(req, res) {
    try {
      const query_platform = req.query.platform;
      if (typeof query_platform !== 'string') throw 'Invalid query';
      const config = await compute_config(config_def, { platform: query_platform });

      res.writeHead(200, { 'Content-Type': 'application/javascript' });

      let watcher: ReturnType<typeof watch_fs> | undefined;

      const hmr = create_hmr_wss({
        client_id: generate_client_id(),
        port: serverPort,
        attach: attach_wss,
        async on_close() {
          (await watcher)?.unsubscribe();
        },
      });

      const { build_full_bundle, build_hmr_payload, symbolicate } = get_bundler(config)(
        hmr.socket_url
      );

      await spin(`📦 Bundling ${config.entryFile} for ${config.platform}`, build_full_bundle(res));

      // server.use('/symbolicate', bodyParser.text({ defaultCharset: 'utf-8' }));
      server.post('/symbolicate', (req, res) => {
        if (!('rawBody' in req)) {
          res.writeHead(400).end('Missing request body.');
          return;
        }
        const input = JSON.parse(req.rawBody);
        const output = symbolicate(input);
        res.writeHead(200);
        res.end(JSON.stringify(output));
      });

      let has_error = false;

      watcher = watch_fs(process.cwd(), async changed_files => {
        try {
          const [result, duration] = await time(build_hmr_payload(changed_files));

          if (!result) return; // This means changed files were not relevant to the bundle

          if (has_error) {
            has_error = false;
            logger.success('Error fixed, serving hot modules again');
          }

          hmr.send_update(result.modules_to_hot_replace, result.code);

          const file_message =
            result.modules_to_hot_replace.length > 1
              ? `${result.modules_to_hot_replace.length} files`
              : result.modules_to_hot_replace[0];
          logger.debug(`♻️  Hot reloaded ${file_message} in ${duration}ms`);
          if (logger.isVerbose()) await writeFile('.tgv-cache/latest-hmr.js', result.code);
        } catch (error) {
          has_error = true;
          print_errors(error);
        }
      });
    } catch (error) {
      print_errors(error);
    }
  });

  server.listen(serverPort, 'localhost');

  logger.success(`👋 Hello, serving on port ${serverPort}`);

  // TODO: make sure we cleanup the server even on forced exit
  return server;
}

function generate_client_id() {
  return crypto.randomBytes(3).toString('hex');
}

const bundlers = new Map<string, DevBundler>();

function get_bundler(options: DevBundlerParams) {
  const key = JSON.stringify(options, Object.keys(options).sort());
  if (!bundlers.has(key)) {
    // TODO: maybe we should free the resources at some point?
    bundlers.set(key, create_dev_bundler(options));
  }
  return bundlers.get(key) as DevBundler;
}
