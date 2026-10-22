import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app';
import type { FirebaseDeps } from './deps';
import { ConfigError, loadConfig } from './lib/config';
import { readErrorCode } from './lib/databaseErrors';
import { describeEnvOverrides, readDotEnv } from './lib/envOverrides';
import { createFirebaseDeps } from './lib/firebase';
import { describeFirebaseSetup, describeStartupFailure } from './lib/firebaseSetup';
import { errorFields, logger } from './lib/logger';
import { createProvider } from './providers';

/** Describes the Firebase setup in the log, then connects. A known setup mistake ends the start. */
function startFirebase(projectId: string): FirebaseDeps {
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
  if (config.NODE_ENV !== 'production') {
    // The dev scripts load ../../.env from the folder they start in (apps/api), so read the same file.
    const file = readDotEnv(resolve(process.cwd(), '../../.env'));
    for (const note of describeEnvOverrides(process.env, file)) logger[note.level](note.message);
  }
  const firebase = config.FIREBASE_PROJECT_ID
    ? startFirebase(config.FIREBASE_PROJECT_ID)
    : undefined;
  const provider = createProvider(config.ANALYTICS_PROVIDER, {
    config,
    snapshots: firebase?.snapshots,
  });
  if (!firebase) {
    logger.warn(
      'FIREBASE_PROJECT_ID is not set: sign-in is disabled and protected routes return 503',
    );
  }

  const app = createApp(config, firebase ? { ...firebase, provider } : undefined);
  const server = app.listen(config.PORT, () => {
    logger.info('API listening', { port: config.PORT, provider: config.ANALYTICS_PROVIDER });
  });
  server.on('error', (err) => {
    if (readErrorCode(err) === 'EADDRINUSE') {
      // The usual cause is an earlier "npm run dev" that was never closed: it keeps answering with
      // the settings it started with, whatever .env says now.
      logger.error(
        `Cannot start: port ${config.PORT} is already in use. Another copy of the API is ` +
          'probably still running (an earlier "npm run dev"), and it keeps the settings it ' +
          'started with. Close it (Windows: netstat -ano | findstr :' +
          `${config.PORT}, then taskkill /PID <number> /F) and start again.`,
      );
    } else {
      logger.error('The API server stopped', errorFields(err));
    }
    process.exit(1);
  });
} catch (err) {
  if (err instanceof ConfigError) {
    logger.error(err.message);
    process.exit(1);
  }
  throw err;
}
