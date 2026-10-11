import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../lib/logger';

/** Error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Every error response uses the shape { error: { code, message } } (AGENTS.md). */
function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'not_found', `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(errorBody(err.code, err.message));
    return;
  }
  // Malformed JSON bodies are a client error, not a server error.
  if (isJsonParseError(err)) {
    res.status(400).json(errorBody('invalid_json', 'Request body is not valid JSON'));
    return;
  }
  logger.error('Unhandled error', {
    name: err instanceof Error ? err.name : 'unknown',
    message: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json(errorBody('internal_error', 'Something went wrong'));
};
