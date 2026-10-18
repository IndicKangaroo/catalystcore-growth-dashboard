import { hasPermission } from '@growth/shared';
import type { Permission, UserRecord } from '@growth/shared';
import type { RequestHandler, Response } from 'express';
import type { TokenVerifier, VerifiedToken } from '../auth/types';
import { logger, errorFields } from '../lib/logger';
import {
  classifyTokenError,
  projectMismatchMessage,
  readProjectMismatch,
} from '../lib/tokenErrors';
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

async function verifyOrReject(verifier: TokenVerifier, idToken: string): Promise<VerifiedToken> {
  try {
    return await verifier.verify(idToken);
  } catch (err) {
    // Log why, never the token. The SDK's message names the expected and the actual project when
    // they differ, which is the usual reason a correct sign-in is rejected.
    const detail = errorFields(err);
    const problem = classifyTokenError(err);

    if (problem === 'service_unavailable') {
      logger.error('Could not reach the sign-in service to check an ID token', detail);
      throw new AppError(
        503,
        'auth_unavailable',
        'Server setup problem: the API could not reach Firebase Auth to check your sign-in. If you ' +
          'are using the emulators, check that "npm run emulators" is running.',
      );
    }

    if (problem === 'wrong_project') {
      logger.error('ID token belongs to a different Firebase project than the API', detail);
      throw new AppError(503, 'project_mismatch', projectMismatchMessage(readProjectMismatch(err)));
    }

    logger.warn('ID token rejected', detail);
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
