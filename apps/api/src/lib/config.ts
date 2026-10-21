import { z } from 'zod';
import { analyticsProviderSchema } from '@growth/shared';

/** Empty strings in .env files count as "not set". */
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  ANALYTICS_PROVIDER: analyticsProviderSchema.default('seed'),
  FIREBASE_PROJECT_ID: optionalString,
  GOOGLE_APPLICATION_CREDENTIALS: optionalString,
  /** Key file of the service account that reads GA4 (D-004). Falls back to GOOGLE_APPLICATION_CREDENTIALS. */
  GA4_SERVICE_ACCOUNT_KEY_FILE: optionalString,
  ADMIN_EMAIL: optionalString,
});

export type Config = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Parses and validates environment variables. Throws ConfigError listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid environment configuration: ${problems}`);
  }
  return result.data;
}
