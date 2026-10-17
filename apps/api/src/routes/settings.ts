import type { StudioSettingsResponse } from '@growth/shared';
import { Router } from 'express';
import { requirePermission } from '../middleware/auth';
import type { StudioSettingsService } from '../settings/service';

export function createSettingsRouter(studio: StudioSettingsService): Router {
  const router = Router();

  // Every screen needs the studio's name, time zone and defaults to draw itself, so every role may
  // read them. Nothing here is a secret. Changing them (settings:write) arrives with P10.
  router.get('/studio', requirePermission('settings:read'), async (_req, res) => {
    const body: StudioSettingsResponse = await studio.get();
    res.json(body);
  });

  return router;
}
