import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../features/auth/session';
import { FilterRow } from '../features/filters/FilterRow';
import { StudioContext, useStudioQuery } from '../features/studio/studio';
import { PRODUCT_NAME } from '../lib/product';
import { Button } from './Button';
import { CenteredCard } from './CenteredCard';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NAV_ITEMS, screenFor } from './navigation';

/**
 * The frame around every screen after sign-in: left rail, top bar, filters, and the page itself.
 * It first loads the studio settings (name, logo, time zone, default range), because the frame and
 * every date on screen depend on them.
 */
export default function AppLayout() {
  const { state, signOut, can } = useSession();
  const studio = useStudioQuery(state.status === 'ready');
  const { pathname } = useLocation();

  const screen = screenFor(pathname);
  const pageName = screen?.label ?? 'Page not found';
  const scope = screen?.filters ?? 'none';
  const studioName = studio.data?.settings.name ?? PRODUCT_NAME;

  useEffect(() => {
    document.title = `${pageName} · ${studioName}`;
  }, [pageName, studioName]);

  if (state.status !== 'ready') return null;

  if (studio.isPending) {
    return (
      <CenteredCard title="Loading">
        <p role="status" className="text-fg-muted">
          Loading the studio settings…
        </p>
      </CenteredCard>
    );
  }

  if (studio.isError) {
    return (
      <CenteredCard title="The studio settings did not load">
        <p role="alert">{studio.error.message}</p>
        <div className="flex gap-2">
          <Button onClick={() => void studio.refetch()}>Try again</Button>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </CenteredCard>
    );
  }

  const items = NAV_ITEMS.filter((entry) => !entry.permission || can(entry.permission));

  return (
    <StudioContext.Provider value={studio.data}>
      <div className="min-h-screen bg-canvas text-fg lg:pl-60">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-card"
        >
          Skip to content
        </a>
        <TopBar pageName={pageName} showRange={scope !== 'none'} />
        <Sidebar items={items} />
        <main id="main" tabIndex={-1} className="outline-none">
          <FilterRow scope={scope} />
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </StudioContext.Provider>
  );
}
