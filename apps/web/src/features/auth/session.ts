import type { MeResponse, Permission } from '@growth/shared';
import { createContext, useContext } from 'react';

export type SessionState =
  | { status: 'loading' }
  | { status: 'not_configured' }
  | { status: 'signed_out' }
  | { status: 'denied'; code: string; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: MeResponse['user']; permissions: Permission[] };

export interface SessionValue {
  state: SessionState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** True when the signed-in person has this permission. */
  can: (permission: Permission) => boolean;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
