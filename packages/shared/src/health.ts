import { z } from 'zod';
import { analyticsProviderSchema } from './enums';

/**
 * Response of GET /api/health, the one public route. The web app reads `provider` to label the
 * data source in the top bar (the demo-data provider shows "Demo data").
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  provider: analyticsProviderSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
