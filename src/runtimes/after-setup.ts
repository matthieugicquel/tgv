/*
 * Everything that we don't need to inject before modules are required should be added here
 * It's injected after most of the RN initialization is done, so things like timers and WebSocket are available
 */

// @ts-expect-error
import DevSettings from 'react-native/Libraries/Utilities/DevSettings';

import type { GlobalThis } from './types';
import type { ServerMessage } from '../ws.types';

// These should be injected by esbuild
declare global {
  let $TGV_CLIENT_ID: string;
  let $TGV_PORT: string;
}

declare var globalThis: GlobalThis;

globalThis.$RN_DEV_HOOKS = {
  perform_full_refresh(reason) {
    if (typeof DevSettings.reload !== 'function') {
      throw new Error('Could not find the reload() implementation.');
    }
    DevSettings.reload(reason);
  },
};

function init_ws() {
  const ws = new WebSocket(`ws://localhost:${$TGV_PORT}`);

  ws.addEventListener('open', () => {
    console.log('🔁 WS connected');
    ws.send(JSON.stringify({ type: 'register', client_id: $TGV_CLIENT_ID }));
  });

  ws.addEventListener('close', () => {
    console.warn('❌ WS disconnected');
  });

  ws.addEventListener('message', ({ data }) => {
    console.log('➡️ message received');
    const parsed = JSON.parse(data) as ServerMessage;

    if (globalThis.globalEvalWithSourceUrl) {
      globalThis.globalEvalWithSourceUrl(parsed.module_string, parsed.sourceURL);
    } else {
      eval(parsed.module_string);
    }
  });
}

init_ws();

// This must happen after React devtools are initialized, otherwise they don't initialize properly
globalThis.$REACT_REFRESH.injectIntoGlobalHook(globalThis);
