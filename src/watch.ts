import watcher from '@parcel/watcher';
import { normalize_path } from './path-utils';

export async function watch(where: string, callback: (changed_files: string[]) => void) {
  const subscription = await watcher.subscribe(where, (error, events) => {
    if (error) {
      console.error(error);
      return;
    }
    callback(events.map(event => normalize_path(event.path)));
  });

  return subscription;
}
