import { Router } from 'express';
import type { AppDeps } from '../deps';
import type { Config } from '../lib/config';
import { createAppService } from '../apps/service';
import { createAuthMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { createStudioSettingsService } from '../settings/service';
import { createUserService } from '../users/service';
import { createAppsRouter } from './apps';
import { createMeRouter } from './me';
import { createSettingsRouter } from './settings';
import { createUsersRouter } from './users';

/** Everything under /api except /api/health needs a signed-in, invited user. */
export function createProtectedRouter(config: Config, deps: AppDeps): Router {
  const users = createUserService({ repo: deps.users, bootstrapAdminEmail: config.ADMIN_EMAIL });
  const apps = createAppService({ repo: deps.apps });
  const studio = createStudioSettingsService(deps.settings);
  const router = Router();
  router.use(createAuthMiddleware({ verifier: deps.verifier, users }));
  router.use('/me', createMeRouter(users));
  router.use('/users', createUsersRouter(users));
  router.use('/apps', createAppsRouter(apps));
  router.use('/settings', createSettingsRouter(studio));
  return router;
}

/** Used when Firebase is not configured, so callers get a clear answer instead of an odd failure. */
export function createUnconfiguredRouter(): Router {
  const router = Router();
  router.use((_req, _res, next) => {
    next(
      new AppError(
        503,
        'auth_not_configured',
        'Sign-in is not configured on this server. Set FIREBASE_PROJECT_ID.',
      ),
    );
  });
  return router;
}
