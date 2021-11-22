import watcher, { Event } from '@parcel/watcher';
import { normalize_path } from './path-utils';

export async function watch(where: string, callback: (event: Event) => void) {
  const subscription = await watcher.subscribe(where, (error, events) => {
    if (error) console.error(error);
    for (const event of events) {
      if (event.type !== 'update') return;
      callback({ ...event, path: normalize_path(event.path) });
    }
  });

  return subscription;
}
