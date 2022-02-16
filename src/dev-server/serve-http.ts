import {
  createDevServerMiddleware,
  indexPageMiddleware,
} from '@react-native-community/cli-server-api';
import { logger } from '@react-native-community/cli-tools';
import * as fs from 'fs';
import http from 'http';
import type { Socket } from 'net';
import polka from 'polka';
import type { WebSocketServer } from 'ws';

const already_logged_missing_handlers = new Set<string>();

export function create_http_server(port: number) {
  const base_server = http.createServer();

  let wss_handlers = new Map<string, WebSocketServer>();

  function attach_wss(path: string, wss: WebSocketServer) {
    wss_handlers.set(path, wss);
  }

  base_server.on('upgrade', (request, socket, head) => {
    for (const [path, wss] of wss_handlers) {
      if (path === request.url) {
        wss.handleUpgrade(request, socket as Socket, head, ws => {
          wss.emit('connection', ws);
        });
        return;
      }
    }

    socket.destroy();
  });

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

  server.get('/hmr/:client-id', (_req, res) => {
    // Send a reconnection signal to the client after the server has restarted
    res.writeHead(205).end();
  });

  // See https://github.com/react-native-community/cli/blob/master/packages/cli-server-api/src/index.ts for what this middleware does
  const { middleware: rn_dev_server_middleware, attachToServer } = createDevServerMiddleware({
    port,
    watchFolders: [],
  });
  rn_dev_server_middleware.use(indexPageMiddleware);
  server.use(rn_dev_server_middleware);

  attachToServer(base_server);

  // server.use('/symbolicate', bodyParser.text());
  // server.post('/symbolicate', (_req, res) => {
  //   // TODO
  //   res.writeHead(200);
  //   res.end();
  // });

  server.get('/assets/*', (req, res) => {
    const fs_path = req.path.replace('/assets/', '');
    const extension = req.path.split('.').pop()?.toLowerCase();

    logger.debug(`🖼  Serving asset ${fs_path}`);
    res.writeHead(200, { 'Content-type': `image/${extension}` });
    fs.createReadStream(fs_path).pipe(res);
  });

  return {
    server,
    attach_wss,
  };
}
