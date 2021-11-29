import { logger } from '@react-native-community/cli-tools';
import { start_dev } from '../src/start-dev';

(async function () {
  try {
    logger.setVerbose(true);
    await start_dev({
      port: 8081,
      entryPoint: 'index.js',
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
