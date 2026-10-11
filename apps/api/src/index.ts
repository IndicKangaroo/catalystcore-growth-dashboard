import { createApp } from './app';
import { ConfigError, loadConfig } from './lib/config';
import { logger } from './lib/logger';

try {
  const config = loadConfig();
  const app = createApp(config);
  app.listen(config.PORT, () => {
    logger.info('API listening', { port: config.PORT, provider: config.ANALYTICS_PROVIDER });
  });
} catch (err) {
  if (err instanceof ConfigError) {
    logger.error(err.message);
    process.exit(1);
  }
  throw err;
}
