import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Config } from './lib/config';
import { errorHandler, notFoundHandler } from './middleware/errors';

export function createApp(config: Config): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  // Public, no auth: used by uptime checks and by the web app's smoke test.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', provider: config.ANALYTICS_PROVIDER });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
