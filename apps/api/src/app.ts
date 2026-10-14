import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppDeps } from './deps';
import type { Config } from './lib/config';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { createProtectedRouter, createUnconfiguredRouter } from './routes';

/**
 * Builds the Express app. `deps` is undefined when Firebase is not configured; protected routes
 * then answer 503 instead of failing in confusing ways.
 */
export function createApp(config: Config, deps?: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  // Public, no auth: used by uptime checks and by the web app's status card.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', provider: config.ANALYTICS_PROVIDER });
  });

  app.use('/api', deps ? createProtectedRouter(config, deps) : createUnconfiguredRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
