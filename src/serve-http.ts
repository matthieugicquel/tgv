import bodyParser from 'body-parser';
import http from 'http';
import polka from 'polka';

type Params<T> = {
  create_ws_server: (server: http.Server) => T;
};

const already_logged_missing_handlers = new Set<string>();

export function create_server<T>({ create_ws_server }: Params<T>) {
  const base_server = http.createServer();

  const ws_server = create_ws_server(base_server);
  const server = polka({
    server: base_server,
    onError(err) {
      console.error(err);
    },
    onNoMatch(req, res) {
      if (req.url && !already_logged_missing_handlers.has(req.url)) {
        console.log(`🤷‍♂️ Handler for ${req.url} not yet implemented`);
        already_logged_missing_handlers.add(req.url);
      }
      res.writeHead(404);
      res.end();
    },
  });

  server.use('/symbolicate', bodyParser.text());
  server.post('/symbolicate', (_req, res) => {
    // TODO
    res.writeHead(200);
    res.end();
  });

  server.get('/status', (_req, res) => {
    res.end('packager-status:running');
  });

  return { server, ws_server };
}

// We should proably embed the middlewares defined here, not rewrite them: https://github.com/react-native-community/cli/blob/641b21f583c97e3d48ce87d5fe804f42db92fa5c/packages/cli/src/commands/start/runServer.ts#L74
