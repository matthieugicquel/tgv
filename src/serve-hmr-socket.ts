import { logger } from '@react-native-community/cli-tools';
import { Server } from 'http';
import WebSocket from 'ws';
import { ClientMessage, ServerMessage } from './ws.types';

export function serve_hmr_socket(server: Server) {
  const wss = new WebSocket.Server({ server });

  const clients = new Map<string, WebSocket>();
  const callbacks = new Map<string, () => void>();

  wss.on('connection', ws => {
    ws.once('message', data => {
      const message: ClientMessage = JSON.parse(data.toString());

      if (message.type === 'register') {
        logger.debug(`🔁 WS connected (id: ${message.client_id})`);
        console.timeEnd(`bundle round trip - ${message.client_id}`);

        clients.set(message.client_id, ws);

        ws.once('close', () => {
          callbacks.get(message.client_id)?.();
          logger.debug(`❌ WS disconnected (id: ${message.client_id})`);
        });
        return;
      }
    });
  });

  const broadcast = (data: ServerMessage) => {
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(JSON.stringify(data));
    }
  };

  return {
    broadcast,
    client(client_id: string, on_close: () => void) {
      callbacks.set(client_id, on_close);
      return {
        send_update(module_string: string) {
          const client = clients.get(client_id);
          // TODO: queue updates while client is not connected?
          if (!client) {
            logger.debug(`Missing client ${client_id}`);
            return;
          }

          const json_payload: ServerMessage = {
            type: 'update',
            sourceURL: 'latest-hmr.js', // TODO
          };

          // Avoid JSON.stringify on the bundle content, it can be huge
          client.send(`${JSON.stringify(json_payload)}§${module_string}`);
        },
      };
    },
  };
}
