import type { z, ZodTypeAny } from 'zod';
import { AppError } from './errors';

/** Parses untrusted input with a Zod schema, or throws a 400 listing every problem. */
export function parseInput<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, 'validation_error', message);
  }
  return result.data;
}
