import { permissionsFor } from '@growth/shared';
import type { MeResponse } from '@growth/shared';
import { Router } from 'express';
import { getAuthContext } from '../middleware/auth';
import type { UserService } from '../users/service';

export function createMeRouter(users: UserService): Router {
  const router = Router();

  // The web app calls this right after sign-in: it tells the caller who they are and what they
  // may do, and records the sign-in time.
  router.get('/', async (_req, res) => {
    const { user } = getAuthContext(res);
    const updated = await users.recordLogin(user.email);
    const body: MeResponse = {
      user: { email: updated.email, name: updated.name, role: updated.role },
      permissions: permissionsFor(updated.role),
    };
    res.json(body);
  });

  return router;
}
