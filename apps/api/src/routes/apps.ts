import { appIdParamsSchema, createAppSchema, updateAppSchema } from '@growth/shared';
import type { AppResponse, AppsResponse } from '@growth/shared';
import { Router } from 'express';
import type { AppService } from '../apps/service';
import { getAuthContext, requirePermission } from '../middleware/auth';
import { parseInput } from '../middleware/validate';

export function createAppsRouter(apps: AppService): Router {
  const router = Router();

  router.get('/', requirePermission('apps:read'), async (_req, res) => {
    const body: AppsResponse = { apps: await apps.list() };
    res.json(body);
  });

  router.get('/:id', requirePermission('apps:read'), async (req, res) => {
    const { id } = parseInput(appIdParamsSchema, req.params);
    const body: AppResponse = { app: await apps.get(id) };
    res.json(body);
  });

  router.post('/', requirePermission('apps:write'), async (req, res) => {
    const input = parseInput(createAppSchema, req.body);
    const { user } = getAuthContext(res);
    const body: AppResponse = { app: await apps.create(input, user.email) };
    res.status(201).json(body);
  });

  router.patch('/:id', requirePermission('apps:write'), async (req, res) => {
    const { id } = parseInput(appIdParamsSchema, req.params);
    const patch = parseInput(updateAppSchema, req.body);
    const body: AppResponse = { app: await apps.update(id, patch) };
    res.json(body);
  });

  router.delete('/:id', requirePermission('apps:write'), async (req, res) => {
    const { id } = parseInput(appIdParamsSchema, req.params);
    await apps.remove(id);
    res.status(204).end();
  });

  return router;
}
