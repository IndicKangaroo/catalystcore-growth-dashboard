import type { Permission } from '@growth/shared';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';
import { CenteredCard } from '../../components/CenteredCard';
import { Notice } from '../../components/Notice';
import { useSession } from './session';

/** Handles the states that apply to every page: still loading, no access, or the API failing. */
export function SessionGate() {
  const { state, signOut } = useSession();

  if (state.status === 'loading') {
    return (
      <CenteredCard title="Loading">
        <p role="status" className="text-fg-muted">
          Checking your session…
        </p>
      </CenteredCard>
    );
  }

  if (state.status === 'denied') {
    return (
      <CenteredCard title="No access">
        <Notice tone="danger">{state.message}</Notice>
        <div>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </CenteredCard>
    );
  }

  if (state.status === 'error') {
    return (
      <CenteredCard title="Something went wrong">
        <Notice tone="danger">{state.message}</Notice>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </CenteredCard>
    );
  }

  return <Outlet />;
}

/** Sends people who are not signed in to the login page, and brings them back afterwards. */
export function RequireSignedIn() {
  const { state } = useSession();
  const location = useLocation();

  if (state.status === 'ready') return <Outlet />;
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

/** Shows the page only to people whose role includes the permission. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useSession();

  if (!can(permission)) {
    return (
      <section aria-labelledby="not-allowed-title">
        <h1 id="not-allowed-title" className="text-2xl font-semibold tracking-tight text-fg">
          Not allowed
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Your role does not include access to this page.
        </p>
      </section>
    );
  }
  return <>{children}</>;
}
