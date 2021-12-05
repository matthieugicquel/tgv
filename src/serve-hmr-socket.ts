import { logger } from '@react-native-community/cli-tools';
import WebSocket from 'ws';
import { ServerMessage } from './ws.types';

type Params = {
  port: number;
  client_id: string;
  attach: (path: string, wss: WebSocket.Server) => void;
  on_close: () => void;
};
export function create_hmr_wss({ port, client_id, attach, on_close }: Params) {
  const wss = new WebSocket.Server({ noServer: true });

  attach(`/hmr/${client_id}`, wss);

  wss.on('connection', ws => {
    logger.debug(`🔁 WS connected (client_id: ${client_id})`);

    ws.once('close', () => {
      logger.debug(`❌ WS disconnected (client_id: ${client_id})`);
      on_close?.();
      wss.close();
    });
  });

  const broadcast = (data: string) => {
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(data);
    }
  };

  return {
    socket_url: construct_socket_url(port, client_id),
    send_update(modules_to_hot_replace: string[], code_payload: string) {
      const json_payload: ServerMessage = {
        type: 'update',
        modules_to_hot_replace,
        sourceURL: '<hmr-payload>', // TODO
      };

      // Avoid JSON.stringify on the bundle content, it can be huge
      broadcast(`${JSON.stringify(json_payload)}§${code_payload}`);
    },
  };
}

function construct_socket_url(port: number, client_id: string) {
  return `ws://localhost:${port}/hmr/${client_id}`;
}
