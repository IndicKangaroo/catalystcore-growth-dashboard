import { emailParamsSchema, inviteUserSchema, updateUserSchema } from '@growth/shared';
import type { UserResponse, UsersResponse } from '@growth/shared';
import { Router } from 'express';
import { getAuthContext, requirePermission } from '../middleware/auth';
import { parseInput } from '../middleware/validate';
import type { UserService } from '../users/service';

export function createUsersRouter(users: UserService): Router {
  const router = Router();
  router.use(requirePermission('users:manage'));

  router.get('/', async (_req, res) => {
    const body: UsersResponse = { users: await users.list() };
    res.json(body);
  });

  // Invite: the person can sign in with Google as soon as this succeeds.
  router.post('/', async (req, res) => {
    const input = parseInput(inviteUserSchema, req.body);
    const { user: actor } = getAuthContext(res);
    const body: UserResponse = { user: await users.invite(input, actor.email) };
    res.status(201).json(body);
  });

  router.patch('/:email', async (req, res) => {
    const { email } = parseInput(emailParamsSchema, req.params);
    const patch = parseInput(updateUserSchema, req.body);
    const body: UserResponse = { user: await users.update(email, patch) };
    res.json(body);
  });

  return router;
}
