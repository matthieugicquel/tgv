/*
 * Everything that we don't need to inject before modules are required should be added here
 * It's injected after most of the RN initialization is done, so things like timers and WebSocket are available
 */

// @ts-expect-error
import DevSettings from 'react-native/Libraries/Utilities/DevSettings';
// @ts-expect-error
import LogBox from 'react-native/Libraries/LogBox/LogBox';

import type { GlobalThis } from './types';
import type { ServerMessage } from '../ws-types';

declare var globalThis: GlobalThis;

globalThis.$RN_DEV_HOOKS = {
  perform_full_refresh(reason) {
    if (typeof DevSettings.reload !== 'function') {
      throw new Error('Could not find the reload() implementation.');
    }
    DevSettings.reload(reason);
  },
};

let was_connected = false;

function init_ws() {
  const ws = new WebSocket(globalThis.$TGV_SOCKET_URL);

  ws.addEventListener('open', () => {
    was_connected = true;
    console.log(`🔁 WS connected to ${globalThis.$TGV_SOCKET_URL}`);
  });

  ws.addEventListener('close', () => {
    console.warn(`❌ Lost connection to dev server`);
    if (was_connected) try_reconnecting();
  });

  ws.addEventListener('message', ({ data }) => {
    console.log('➡️ message received');

    const [message_string, payload] = (data as string).split('§', 2) as [
      message: string,
      payload: string | undefined
    ];

    const message = JSON.parse(message_string) as ServerMessage;

    if (!payload) {
      console.warn('Missing payload');
      return;
    }

    LogBox.clearAllLogs?.();

    try {
      if (globalThis.globalEvalWithSourceUrl) {
        globalThis.globalEvalWithSourceUrl(payload, message.sourceURL);
      } else {
        eval(payload);
      }

      globalThis.$PERFORM_REFRESH(message.modules_to_hot_replace);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  });
}

let abort = new AbortController();

async function try_reconnecting() {
  setInterval(async () => {
    abort.abort();
    abort = new AbortController();

    const response = await fetch(globalThis.$TGV_SOCKET_URL.replace('ws', 'http'), {
      signal: abort.signal,
    });

    if (response.status === 205) {
      DevSettings.reload('Reconnecting after server came back online');
    }
  }, 1000);
}

init_ws();

// This must happen after React devtools are initialized, otherwise they don't initialize properly
globalThis.$REACT_REFRESH.injectIntoGlobalHook(globalThis);
