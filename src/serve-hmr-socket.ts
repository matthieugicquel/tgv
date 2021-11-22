import { Server } from 'http';
import WebSocket from 'ws';
import { ClientMessage, ServerMessage } from './ws.types';

export function serve_hmr_socket(server: Server) {
  const wss = new WebSocket.Server({ server });

  const broadcast = (data: ServerMessage) => {
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(JSON.stringify(data));
    }
  };

  return {
    expect_client(client_id: string, on_close: () => void) {
      let client: WebSocket;
      wss.on('connection', ws => {
        ws.once('message', data => {
          const message: ClientMessage = JSON.parse(data.toString());

          if (message.type === 'register' && message.client_id === client_id) {
            console.log(`🔁 WS connected (id: ${message.client_id})`);
            client = ws;

            ws.on('close', () => {
              on_close();
              console.log(`❌ WS disconnected (id: ${client_id})`);
            });
            return;
          }
        });
      });

      return {
        send_update(module_string: string, sourceURL: string) {
          // TODO: queue updates while client is not connected?
          client?.send(
            JSON.stringify({
              type: 'update',
              module_string: module_string,
              sourceURL,
            })
          );
        },
      };
    },
    close() {
      wss.close();
    },
  };
}
