import type { MeResponse } from '@growth/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, apiFetch } from '../../lib/api';
import { isFirebaseConfigured, signInWithGoogle, signOutUser, watchAuth } from '../../lib/firebase';
import { SessionContext } from './session';
import type { SessionState, SessionValue } from './session';

/**
 * Combines two things into one session: whether Firebase says someone is signed in, and whether the
 * API accepts them (they must have been invited). The API is the authority on roles.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const configured = isFirebaseConfigured();

  // undefined: still checking. null: signed out. string: the signed-in Firebase uid.
  const [uid, setUid] = useState<string | null | undefined>(configured ? undefined : null);

  useEffect(() => (configured ? watchAuth(setUid) : undefined), [configured]);

  const me = useQuery({
    queryKey: ['me', uid ?? null],
    queryFn: () => apiFetch<MeResponse>('/api/me'),
    enabled: typeof uid === 'string',
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const state = useMemo<SessionState>(() => {
    if (!configured) return { status: 'not_configured' };
    if (uid === undefined) return { status: 'loading' };
    if (uid === null) return { status: 'signed_out' };

    if (me.isError) {
      const error = me.error;
      if (error instanceof ApiError && error.status === 403) {
        return { status: 'denied', code: error.code, message: error.message };
      }
      return { status: 'error', message: error.message };
    }
    if (me.data) {
      return { status: 'ready', user: me.data.user, permissions: me.data.permissions };
    }
    return { status: 'loading' };
  }, [configured, uid, me.isError, me.error, me.data]);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      signIn: signInWithGoogle,
      signOut: async () => {
        await signOutUser();
        // Nothing cached for this person may be shown to whoever signs in next.
        queryClient.clear();
      },
      can: (permission) => state.status === 'ready' && state.permissions.includes(permission),
    }),
    [state, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
