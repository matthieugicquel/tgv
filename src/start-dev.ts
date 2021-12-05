import { bundle, create_dev_bundler, DevBundler, DevBundlerParams } from './build';
import { print_errors, spin } from './reporter';
import { create_http_server } from './serve-http';
import { watch } from './watch';
import crypto from 'crypto';
import * as fs from 'fs';
import { logger } from '@react-native-community/cli-tools';
import { create_hmr_wss } from './serve-hmr-socket';
import { time } from './utils';

const MODE: 'HMR' | 'BUNDLE' | 'SERVE-CACHE' = 'HMR';

type Params = {
  port: number;
  entryPoint: string;
};

export async function start_dev({ port, entryPoint }: Params) {
  logger.success(`👋 Hello, serving on port ${port}`);

  if (!fs.existsSync('.tgv-cache')) fs.mkdirSync('.tgv-cache');

  const { server, attach_wss } = create_http_server(port);

  server.get('/index.bundle', async function bundle_request(req, res) {
    try {
      const platform = req.query.platform;
      if (typeof platform !== 'string') throw 'Invalid query';
      assert_supported_platform(platform);

      if (MODE === 'HMR') {
        const client_id = generate_client_id();

        res.writeHead(200, { 'Content-Type': 'application/javascript' });

        let watcher: ReturnType<typeof watch> | undefined;

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

        await spin(`🚀 Bundling ${entryPoint} for ${platform}`, build_full_bundle(res));

        watcher = watch(process.cwd(), async changed_files => {
          try {
            const [result, duration] = await time(build_hmr_payload(changed_files));
            if (!result) return;
            hmr.send_update(result.modules_to_hot_replace, result.code);
            logger.debug(
              `♻️  Hot reloaded ${result.modules_to_hot_replace.length} files in ${duration}ms`
            );
          } catch (error) {
            print_errors(error);
          }
        });
      } else if (MODE === 'BUNDLE') {
        await spin(`🚀 Bundling ${entryPoint} for ${platform}`, bundle({ entryPoint, platform }));
      } /* MODE === 'SERVE-CACHE' */ else {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        fs.createReadStream(`.tgv-cache/${entryPoint}`).pipe(res);
      }
    } catch (error) {
      print_errors(error);
    }
  });

  server.listen(port, 'localhost');

  // TODO: make sure we cleanup the server even on forced exit

  return server;
}

function generate_client_id() {
  return crypto.randomBytes(8).toString('hex');
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

function assert_supported_platform(platform: string): asserts platform is 'ios' | 'android' {
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}
