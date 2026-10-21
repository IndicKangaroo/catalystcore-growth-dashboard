import { analyticsQuerySchema, appIdParamsSchema, metricSchema } from '@growth/shared';
import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth';
import { parseInput } from '../middleware/validate';
import type { MetricsService } from '../metrics/service';

const seriesQuerySchema = z.object({ metric: metricSchema });

/**
 * The numbers behind the Overview and App detail screens. Every route needs `metrics:read` (D-025)
 * and takes the global filters as query parameters, with the range already turned into `from` and
 * `to` (D-031). This router is mounted at `/api`, because two of its paths sit under `/apps/:id`.
 */
export function createMetricsRouter(metrics: MetricsService): Router {
  const router = Router();

  router.get('/metrics/overview', requirePermission('metrics:read'), async (req, res) => {
    const query = parseInput(analyticsQuerySchema, req.query);
    res.json(await metrics.overview(query));
  });

  router.get('/metrics/series', requirePermission('metrics:read'), async (req, res) => {
    const query = parseInput(analyticsQuerySchema, req.query);
    const { metric } = parseInput(seriesQuerySchema, req.query);
    res.json(await metrics.series(query, metric));
  });

  router.get('/apps/:id/users', requirePermission('metrics:read'), async (req, res) => {
    const { id } = parseInput(appIdParamsSchema, req.params);
    const query = parseInput(analyticsQuerySchema, req.query);
    res.json(await metrics.appUsers(id, query));
  });

  router.get('/apps/:id/retention', requirePermission('metrics:read'), async (req, res) => {
    const { id } = parseInput(appIdParamsSchema, req.params);
    const query = parseInput(analyticsQuerySchema, req.query);
    res.json(await metrics.retention(id, query));
  });

  return router;
}
