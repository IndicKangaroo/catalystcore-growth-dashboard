import { DEFAULT_STUDIO_SETTINGS, permissionsFor } from '@growth/shared';
import type {
  AppRecord,
  Role,
  StudioSettings,
  StudioSettingsResponse,
  UserRecord,
} from '@growth/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { SessionContext } from '../features/auth/session';
import type { SessionState, SessionValue } from '../features/auth/session';
import { StudioContext } from '../features/studio/studio';

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

/** What GET /api/settings/studio answers: the defaults, with whatever the test changes. */
export function makeStudio(
  settings: Partial<StudioSettings> = {},
  configured = true,
): StudioSettingsResponse {
  return { settings: { ...DEFAULT_STUDIO_SETTINGS, ...settings }, configured };
}

/**
 * Renders the UI inside a router, a query client and a session in the given state, so a test can
 * pick the state it needs without going through Firebase. Screens that read the studio settings
 * get `studio` (the defaults unless given); pass null when the UI loads them itself, as the app
 * layout does.
 */
export function renderWithSession(
  ui: ReactElement,
  {
    state,
    route = '/',
    studio = makeStudio(),
  }: { state: SessionState; route?: RouteEntry; studio?: StudioSettingsResponse | null },
) {
  const session = makeSession(state);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={session}>
        <StudioContext.Provider value={studio}>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </StudioContext.Provider>
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

let appCounter = 0;

/** A stored app. Each call gets its own id and package name unless the test sets them. */
export function makeApp(overrides: Partial<AppRecord> = {}): AppRecord {
  appCounter += 1;
  return {
    id: `app${appCounter}`,
    name: `Test App ${appCounter}`,
    packageName: `com.example.app${appCounter}`,
    status: 'development',
    iconUrl: null,
    ga4PropertyId: null,
    firebaseProjectId: null,
    playStoreUrl: null,
    launchDate: null,
    category: null,
    currentVersion: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin@example.com',
    ...overrides,
  };
}
