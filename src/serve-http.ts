import bodyParser from 'body-parser';
import http from 'http';
import polka from 'polka';
import * as fs from 'fs';
import {
  createDevServerMiddleware,
  indexPageMiddleware,
} from '@react-native-community/cli-server-api';
import { logger } from '@react-native-community/cli-tools';

type Params<T> = {
  port: number;
  create_ws_server: (server: http.Server) => T;
};

const already_logged_missing_handlers = new Set<string>();

export function create_server<T>({ port, create_ws_server }: Params<T>) {
  const base_server = http.createServer();

  const ws_server = create_ws_server(base_server);
  const server = polka({
    server: base_server,
    onError(err) {
      console.error(err);
    },
    onNoMatch(req, res) {
      if (req.url && !already_logged_missing_handlers.has(req.url)) {
        logger.debug(`🤷‍♂️ Handler for ${req.url} not yet implemented`);
        already_logged_missing_handlers.add(req.url);
      }
      res.writeHead(404).end();
    },
  });

  // See https://github.com/react-native-community/cli/blob/master/packages/cli-server-api/src/index.ts for what this middleware does
  const { middleware: rn_dev_server_middleware } = createDevServerMiddleware({
    port,
    watchFolders: [],
  });
  rn_dev_server_middleware.use(indexPageMiddleware);
  server.use(rn_dev_server_middleware);

  server.use('/symbolicate', bodyParser.text());
  server.post('/symbolicate', (_req, res) => {
    // TODO
    res.writeHead(200);
    res.end();
  });

  server.get('/assets-server/*', (req, res) => {
    const fs_path = req.path.replace('/assets-server/', '');
    logger.debug(`🖼  Serving asset ${fs_path}`);
    // TODO: support all extensions, or maybe setting the content-type is not necessary?
    res.writeHead(200, { 'Content-type': 'image/png' });
    fs.createReadStream(fs_path).pipe(res);
  });

  return { server, ws_server };
}

// We should proably embed the middlewares defined here, not rewrite them: https://github.com/react-native-community/cli/blob/641b21f583c97e3d48ce87d5fe804f42db92fa5c/packages/cli/src/commands/start/runServer.ts#L74
