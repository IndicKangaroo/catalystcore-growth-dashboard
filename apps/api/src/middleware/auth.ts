import { hasPermission } from '@growth/shared';
import type { Permission, UserRecord } from '@growth/shared';
import type { RequestHandler, Response } from 'express';
import type { TokenVerifier, VerifiedToken } from '../auth/types';
import { logger } from '../lib/logger';
import type { UserService } from '../users/service';
import { AppError } from './errors';

/** Who is making the request. Set by the auth middleware and read by route handlers. */
export interface AuthContext {
  uid: string;
  user: UserRecord;
}

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

function readBearerToken(header: string | undefined): string | null {
  const match = header ? BEARER_PATTERN.exec(header) : null;
  return match?.[1] ?? null;
}

function errorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return 'unknown';
}

async function verifyOrReject(verifier: TokenVerifier, idToken: string): Promise<VerifiedToken> {
  try {
    return await verifier.verify(idToken);
  } catch (err) {
    // Log the reason code only, never the token.
    logger.warn('ID token rejected', { reason: errorCode(err) });
    throw new AppError(
      401,
      'invalid_token',
      'Your session is invalid or has expired. Sign in again.',
    );
  }
}

/**
 * Requires a valid Firebase ID token from an invited, active user (D-021). The user record is read
 * on every request, so role changes and deactivation take effect immediately.
 */
export function createAuthMiddleware(deps: {
  verifier: TokenVerifier;
  users: UserService;
}): RequestHandler {
  return async (req, res, next) => {
    const idToken = readBearerToken(req.headers.authorization);
    if (!idToken) {
      throw new AppError(401, 'unauthenticated', 'Sign in to continue');
    }

    const verified = await verifyOrReject(deps.verifier, idToken);
    if (!verified.email) {
      throw new AppError(403, 'email_required', 'This account has no email address');
    }
    if (!verified.emailVerified) {
      throw new AppError(
        403,
        'email_not_verified',
        'Verify your email address with your sign-in provider first',
      );
    }

    const user = await deps.users.resolveSignedIn({ ...verified, email: verified.email });
    const context: AuthContext = { uid: verified.uid, user };
    res.locals.auth = context;
    next();
  };
}

export function getAuthContext(res: Response): AuthContext {
  const context = res.locals.auth as AuthContext | undefined;
  if (!context) {
    throw new AppError(500, 'internal_error', 'Missing authentication context');
  }
  return context;
}

/** Use after the auth middleware. Routes check permissions, never role names (D-025). */
export function requirePermission(permission: Permission): RequestHandler {
  return (_req, res, next) => {
    const { user } = getAuthContext(res);
    if (!hasPermission(user.role, permission)) {
      throw new AppError(403, 'forbidden', 'You do not have permission to do this');
    }
    next();
  };
}
