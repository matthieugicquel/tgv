import { logger } from '@react-native-community/cli-tools';
import { tgv_start } from '../src/dev-server-command';

(async function () {
  try {
    logger.setVerbose(true);
    await tgv_start(undefined, undefined, {
      port: 8081,
      entryPoint: 'index.js',
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
