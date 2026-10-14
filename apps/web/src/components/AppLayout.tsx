import { ROLE_LABELS } from '@growth/shared';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../features/auth/session';
import { Button } from './Button';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-2 py-1 text-sm font-medium',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    isActive ? 'bg-muted text-fg' : 'text-fg-muted hover:text-fg',
  ].join(' ');

/** Header with navigation and the signed-in person, around whichever page is showing. */
export default function AppLayout() {
  const { state, signOut, can } = useSession();
  if (state.status !== 'ready') return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="text-base font-semibold">Growth Analytics</span>
          <nav aria-label="Main" className="flex flex-1 items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            {can('users:manage') && (
              <NavLink to="/settings/users" className={linkClass}>
                Users
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-fg-muted">
              {`${state.user.email} · ${ROLE_LABELS[state.user.role]}`}
            </span>
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
