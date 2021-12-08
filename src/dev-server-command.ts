import { create_dev_bundler, DevBundler, BundlerParams } from './dev-server/dev-bundler';
import { print_errors, spin } from './utils/console';
import { create_http_server } from './dev-server/serve-http';
import { watch_fs } from './dev-server/fs-watcher';
import crypto from 'crypto';
import * as fs from 'fs';
import { logger } from '@react-native-community/cli-tools';
import { create_hmr_wss } from './dev-server/serve-hmr-socket';
import { time } from './utils/utils';
import { assert_supported_platform } from './utils/platform';

type Params = {
  port: number;
  entryPoint: string;
};

export async function tgv_start(_: unknown, __: unknown, { port, entryPoint }: Params) {
  if (!fs.existsSync('.tgv-cache')) fs.mkdirSync('.tgv-cache');

  const { server, attach_wss } = create_http_server(port);

  server.get('/index.bundle', async function bundle_request(req, res) {
    try {
      const platform = req.query.platform;
      if (typeof platform !== 'string') throw 'Invalid query';
      assert_supported_platform(platform);

      const client_id = generate_client_id();

      res.writeHead(200, { 'Content-Type': 'application/javascript' });

      let watcher: ReturnType<typeof watch_fs> | undefined;

      const hmr = create_hmr_wss({
        client_id,
        port,
        attach: attach_wss,
        async on_close() {
          (await watcher)?.unsubscribe();
        },
      });

      const { build_full_bundle, build_hmr_payload } = get_bundler({ platform, entryPoint })(
        hmr.socket_url
      );

      await spin(`📦 Bundling ${entryPoint} for ${platform}`, build_full_bundle(res));

      let has_error = false;

      watcher = watch_fs(process.cwd(), async changed_files => {
        try {
          const [result, duration] = await time(build_hmr_payload(changed_files));
          if (!result) return;
          if (has_error) {
            has_error = false;
            logger.success('Error fixed, serving hot modules again');
          }
          hmr.send_update(result.modules_to_hot_replace, result.code);
          logger.debug(
            `♻️  Hot reloaded ${result.modules_to_hot_replace.length} files in ${duration}ms`
          );
        } catch (error) {
          has_error = true;
          print_errors(error);
        }
      });
    } catch (error) {
      print_errors(error);
    }
  });

  server.listen(port, 'localhost');

  logger.success(`👋 Hello, serving on port ${port}`);

  // TODO: make sure we cleanup the server even on forced exit
  return server;
}

function generate_client_id() {
  return crypto.randomBytes(3).toString('hex');
}

const bundlers = new Map<string, DevBundler>();

function get_bundler(options: BundlerParams) {
  const key = JSON.stringify(options, Object.keys(options).sort());
  if (!bundlers.has(key)) {
    // TODO: maybe we should free the resources at some point?
    bundlers.set(key, create_dev_bundler(options));
  }
  return bundlers.get(key) as DevBundler;
}
