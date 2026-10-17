import { ROLE_LABELS } from '@growth/shared';
import type { AnalyticsProviderName, AppRecord, StudioSettingsResponse } from '@growth/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { SessionState } from '../features/auth/session';
import OverviewPage from '../features/home/OverviewPage';
import { apiError, stubApi } from '../test/api';
import { makeApp, makeStudio, readyState, renderWithSession } from '../test/helpers';
import AppLayout from './AppLayout';

// Every request goes through the real apiFetch; only the sign-in token is faked.
vi.mock('../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

interface Backend {
  studio?: StudioSettingsResponse;
  provider?: AnalyticsProviderName;
  apps?: AppRecord[];
}

function stubBackend({
  studio = makeStudio({ name: 'Orbit Studio' }),
  provider = 'seed',
  apps = [],
}: Backend = {}) {
  return stubApi({
    '/api/settings/studio': { body: studio },
    '/api/health': { body: { status: 'ok', provider } },
    '/api/apps': { body: { apps } },
  });
}

interface ShellOptions {
  route?: string;
  /** What the home address shows inside the frame. */
  page?: ReactElement;
}

function renderShell(state: SessionState, { route = '/', page }: ShellOptions = {}) {
  return renderWithSession(
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={page ?? <p>Overview body</p>} />
        <Route path="apps" element={<p>Apps body</p>} />
        <Route path="settings/users" element={<p>Users body</p>} />
        <Route path="*" element={<p>Missing body</p>} />
      </Route>
    </Routes>,
    // The layout loads the studio settings itself, so the test gives it none.
    { state, route, studio: null },
  );
}

const menu = () => screen.findByRole('navigation', { name: 'Main' });

describe('AppLayout', () => {
  it('loads the studio settings first, then shows the frame around the page', async () => {
    stubBackend();
    renderShell(readyState('admin', 'ada@example.com', 'Ada Admin'));

    expect(screen.getByRole('status')).toHaveTextContent('Loading the studio settings…');
    expect(await screen.findByText('Overview body')).toBeInTheDocument();

    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('Orbit Studio')).toBeInTheDocument();
    expect(within(bar).getByText('Overview')).toBeInTheDocument();
    expect(within(bar).getByText('Ada Admin')).toBeInTheDocument();
    expect(within(bar).getByText(ROLE_LABELS.admin)).toBeInTheDocument();

    // The left rail repeats the studio's name, with the product's name beneath it.
    expect(screen.getAllByText('Orbit Studio')).toHaveLength(2);
    expect(screen.getByText('Growth Analytics')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Overview · Orbit Studio'));
  });

  it('falls back to the product name while the studio has no name', async () => {
    stubBackend({ studio: makeStudio({ name: null }, false) });
    renderShell(readyState());

    expect(await screen.findByText('Overview body')).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('Growth Analytics')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Overview · Growth Analytics'));
  });

  it('says when the studio settings did not load, and tries again on request', async () => {
    let attempts = 0;
    stubApi({
      '/api/settings/studio': () => {
        attempts += 1;
        return attempts === 1
          ? apiError(500, 'internal_error', 'Could not read the studio settings.')
          : { body: makeStudio({ name: 'Orbit Studio' }) };
      },
      '/api/health': { body: { status: 'ok', provider: 'seed' } },
      '/api/apps': { body: { apps: [] } },
    });
    renderShell(readyState());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not read the studio settings.',
    );
    expect(screen.queryByText('Overview body')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Overview body')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('does nothing, and asks the API for nothing, before sign-in', () => {
    const requests = stubBackend();

    const { container } = renderShell({ status: 'signed_out' });

    expect(container).toBeEmptyDOMElement();
    expect(requests).toHaveLength(0);
  });

  it.each([
    { role: 'admin', labels: ['Overview', 'Apps', 'Users'] },
    { role: 'growth', labels: ['Overview', 'Apps'] },
    { role: 'developer', labels: ['Overview', 'Apps'] },
  ] as const)('lists only the screens the $role role may open', async ({ role, labels }) => {
    stubBackend();
    renderShell(readyState(role));

    const links = within(await menu()).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual(labels);
  });

  it('marks the screen showing, in the menu and in the top bar', async () => {
    stubBackend();
    renderShell(readyState('admin'), { route: '/apps' });

    const links = within(await menu());
    expect(links.getByRole('link', { name: 'Apps' })).toHaveAttribute('aria-current', 'page');
    expect(links.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    expect(links.getByRole('link', { name: 'Users' })).not.toHaveAttribute('aria-current');
    expect(within(screen.getByRole('banner')).getByText('Apps')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Apps · Orbit Studio'));
  });

  it('carries the filters in the menu links, except to screens that do not use them', async () => {
    stubBackend({ apps: [makeApp({ id: 'a1', name: 'Alpha' })] });
    renderShell(readyState('admin'), { route: '/?range=7d&appIds=a1' });

    const links = within(await menu());

    expect(links.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/?range=7d&appIds=a1',
    );
    expect(links.getByRole('link', { name: 'Apps' })).toHaveAttribute(
      'href',
      '/apps?range=7d&appIds=a1',
    );
    expect(links.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/settings/users');
  });

  it('offers the date range on a screen that uses it', async () => {
    stubBackend();
    renderShell(readyState('admin'), { route: '/apps' });

    expect(await screen.findByRole('group', { name: 'Date range' })).toBeInTheDocument();
  });

  it('puts the custom dates and the app chips in a strip at the top of the main area', async () => {
    stubBackend({ apps: [makeApp({ id: 'a1', name: 'Alpha' })] });
    renderShell(readyState('admin'), {
      route: '/?range=custom&from=2026-10-01&to=2026-10-15',
    });

    const main = within(await screen.findByRole('main'));

    expect(main.getByRole('group', { name: 'Custom date range' })).toBeInTheDocument();
    expect(await main.findByRole('group', { name: 'Apps' })).toBeInTheDocument();
    expect(main.getByText('Overview body')).toBeInTheDocument();
  });

  it('leaves the date range out of a screen that does not use it', async () => {
    stubBackend();
    renderShell(readyState('admin'), { route: '/settings/users' });

    expect(await screen.findByText('Users body')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Date range' })).not.toBeInTheDocument();
  });

  it('names an unknown address "Page not found" and leaves the date range out', async () => {
    stubBackend();
    renderShell(readyState(), { route: '/no/such/page' });

    expect(await screen.findByText('Missing body')).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Date range' })).not.toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Page not found · Orbit Studio'));
  });

  it('has the theme toggle, a way to sign out, and a way past the menu', async () => {
    stubBackend();
    const { session } = renderShell(readyState());
    await screen.findByText('Overview body');

    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(session.signOut).toHaveBeenCalledTimes(1);
  });

  it('labels demo data in the top bar', async () => {
    stubBackend({ provider: 'seed' });
    renderShell(readyState());

    const bar = await screen.findByRole('banner');

    expect(await within(bar).findByText('Demo data')).toBeInTheDocument();
  });

  it('puts no label in the top bar for real analytics', async () => {
    stubBackend({ provider: 'ga4' });
    renderShell(readyState(), { page: <OverviewPage /> });

    // The overview names the source once the API has answered; the top bar read the same answer.
    expect(await screen.findByText('Google Analytics 4')).toBeInTheDocument();
    expect(screen.queryByText('Demo data')).not.toBeInTheDocument();
  });
});
