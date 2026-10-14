import { permissionsFor } from '@growth/shared';
import type { Role, UserRecord } from '@growth/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { SessionContext } from '../features/auth/session';
import type { SessionState, SessionValue } from '../features/auth/session';

type RouteEntry = NonNullable<ComponentProps<typeof MemoryRouter>['initialEntries']>[number];

/** A signed-in session with the permissions the shared matrix gives the role. */
export function readyState(
  role: Role = 'admin',
  email = 'admin@example.com',
  name: string | null = 'Ada Admin',
): SessionState {
  return { status: 'ready', user: { email, name, role }, permissions: permissionsFor(role) };
}

export function makeSession(state: SessionState): SessionValue {
  return {
    state,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    can: (permission) => state.status === 'ready' && state.permissions.includes(permission),
  };
}

/**
 * Renders the UI inside a router, a query client and a session in the given state, so a test can
 * pick the state it needs without going through Firebase.
 */
export function renderWithSession(
  ui: ReactElement,
  { state, route = '/' }: { state: SessionState; route?: RouteEntry },
) {
  const session = makeSession(state);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={session}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );

  return { ...view, session, queryClient };
}

export function makeUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    email: 'person@example.com',
    name: null,
    role: 'growth',
    active: true,
    uid: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin@example.com',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    ...overrides,
  };
}
