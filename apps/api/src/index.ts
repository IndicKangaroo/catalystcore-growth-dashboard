import { createApp } from './app';
import { ConfigError, loadConfig } from './lib/config';
import { createFirebaseDeps } from './lib/firebase';
import { logger } from './lib/logger';

try {
  const config = loadConfig();
  const deps = config.FIREBASE_PROJECT_ID
    ? createFirebaseDeps(config.FIREBASE_PROJECT_ID)
    : undefined;
  if (!deps) {
    logger.warn(
      'FIREBASE_PROJECT_ID is not set: sign-in is disabled and protected routes return 503',
    );
  }

  const app = createApp(config, deps);
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
