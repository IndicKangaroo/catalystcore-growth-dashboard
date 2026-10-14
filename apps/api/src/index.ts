import { existsSync } from 'node:fs';
import { createApp } from './app';
import type { AppDeps } from './deps';
import { ConfigError, loadConfig } from './lib/config';
import { createFirebaseDeps } from './lib/firebase';
import { describeFirebaseSetup, describeStartupFailure } from './lib/firebaseSetup';
import { errorFields, logger } from './lib/logger';

/** Describes the Firebase setup in the log, then connects. A known setup mistake ends the start. */
function startFirebase(projectId: string): AppDeps {
  for (const note of describeFirebaseSetup(process.env, existsSync)) {
    logger[note.level](note.message);
  }
  try {
    return createFirebaseDeps(projectId);
  } catch (err) {
    const explanation = describeStartupFailure(err);
    if (!explanation) throw err;
    logger.error(`Cannot start: ${explanation}`, errorFields(err));
    process.exit(1);
  }
}

try {
  const config = loadConfig();
  const deps = config.FIREBASE_PROJECT_ID ? startFirebase(config.FIREBASE_PROJECT_ID) : undefined;
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
