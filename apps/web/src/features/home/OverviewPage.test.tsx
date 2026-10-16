import type {
  AnalyticsProviderName,
  AppRecord,
  Role,
  StudioSettingsResponse,
} from '@growth/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiError, stubApi } from '../../test/api';
import type { ApiReply } from '../../test/api';
import { makeApp, makeStudio, readyState, renderWithSession } from '../../test/helpers';
import OverviewPage from './OverviewPage';

// The cards read through the real apiFetch; only the sign-in token is faked.
vi.mock('../../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

const healthOf = (provider: AnalyticsProviderName): ApiReply => ({
  body: { status: 'ok', provider },
});
const appsOf = (apps: AppRecord[]): ApiReply => ({ body: { apps } });

function stubBackend(health: ApiReply = healthOf('seed'), apps: ApiReply = appsOf([])) {
  stubApi({ '/api/health': health, '/api/apps': apps });
}

interface Options {
  role?: Role;
  name?: string | null;
  route?: string;
  studio?: StudioSettingsResponse;
}

function renderOverview({ role = 'admin', name = 'Ada Admin', route = '/', studio }: Options = {}) {
  return renderWithSession(<OverviewPage />, {
    state: readyState(role, 'ada@example.com', name),
    route,
    studio,
  });
}

/** The card under a heading such as "Data source": the heading's parent holds the whole card. */
function card(label: string) {
  const heading = screen.getByRole('heading', { name: label });
  const element = heading.parentElement;
  if (!element) throw new Error(`No card around the "${label}" heading`);
  return within(element);
}

/** A moment that is midday on 15 October 2026 where the studio is (Asia/Kolkata). */
function setClockToMiddayInKolkata() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
}

describe('OverviewPage', () => {
  it('welcomes the person by name', async () => {
    stubBackend();
    renderOverview({ name: 'Ada Admin' });

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Ada Admin\./)).toBeInTheDocument();
    await card('Data source').findByText('Demo data');
  });

  it('welcomes a person who has no name on their account by their email address', async () => {
    stubBackend();
    renderOverview({ role: 'growth', name: null });

    expect(screen.getByText(/Welcome, ada@example\.com\./)).toBeInTheDocument();
    await card('Data source').findByText('Demo data');
  });

  describe('studio settings notice', () => {
    it('warns that the defaults are in use while the settings have not been saved', async () => {
      stubBackend();
      renderOverview({ studio: makeStudio({}, false) });

      expect(screen.getByText('The studio settings have not been saved yet.')).toBeInTheDocument();
      expect(
        screen.getByText(
          /time zone Asia\/Kolkata, currency INR, and Last 30 days as the first view/,
        ),
      ).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
    });

    it('says nothing once they are saved', async () => {
      stubBackend();
      renderOverview({ studio: makeStudio({ name: 'Orbit Studio' }, true) });

      await card('Data source').findByText('Demo data');
      expect(
        screen.queryByText('The studio settings have not been saved yet.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('data source card', () => {
    it('calls the demo provider demo data, and says the numbers are generated', async () => {
      stubBackend(healthOf('seed'));
      renderOverview();
      const source = card('Data source');
      expect(source.getByText('Checking…')).toBeInTheDocument();

      expect(await source.findByText('Demo data')).toBeInTheDocument();
      expect(
        source.getByText(
          'Generated sample numbers. Real analytics arrive with the GA4 connection.',
        ),
      ).toBeInTheDocument();
    });

    it('names Google Analytics 4 when that is the source', async () => {
      stubBackend(healthOf('ga4'));
      renderOverview();
      const source = card('Data source');

      expect(await source.findByText('Google Analytics 4')).toBeInTheDocument();
      expect(source.getByText('Numbers are read from Google Analytics 4.')).toBeInTheDocument();
      expect(source.queryByText('Demo data')).not.toBeInTheDocument();
    });

    it('says the API is not reachable, with the reason, instead of guessing a source', async () => {
      stubBackend(apiError(500, 'internal_error', 'The API did not answer.'));
      renderOverview();
      const source = card('Data source');

      expect(await source.findByText('API not reachable')).toBeInTheDocument();
      expect(source.getByText('The API did not answer.')).toBeInTheDocument();
      expect(source.queryByText('Demo data')).not.toBeInTheDocument();
    });
  });

  describe('apps card', () => {
    it('counts the apps and how many have a GA4 property set', async () => {
      stubBackend(
        healthOf('seed'),
        appsOf([makeApp({ ga4PropertyId: '123456789' }), makeApp(), makeApp()]),
      );
      renderOverview();
      const apps = card('Apps');
      expect(apps.getByText('Loading…')).toBeInTheDocument();

      expect(await apps.findByText('3 apps')).toBeInTheDocument();
      expect(apps.getByText('1 of 3 with a GA4 property set')).toBeInTheDocument();
      expect(apps.getByRole('link', { name: 'Manage apps' })).toHaveAttribute('href', '/apps');
    });

    it('says "1 app" for a single app', async () => {
      stubBackend(healthOf('seed'), appsOf([makeApp()]));
      renderOverview();

      expect(await card('Apps').findByText('1 app')).toBeInTheDocument();
      expect(card('Apps').getByText('0 of 1 with a GA4 property set')).toBeInTheDocument();
    });

    it('keeps the filters in the link to the Apps screen', async () => {
      stubBackend(healthOf('seed'), appsOf([makeApp()]));
      renderOverview({ route: '/?range=7d' });

      expect(await card('Apps').findByRole('link', { name: 'Manage apps' })).toHaveAttribute(
        'href',
        '/apps?range=7d',
      );
    });

    it('invites an admin to add the first apps', async () => {
      stubBackend(healthOf('seed'), appsOf([]));
      renderOverview({ role: 'admin' });
      const apps = card('Apps');

      expect(await apps.findByText('No apps yet')).toBeInTheDocument();
      expect(apps.getByText('Add the apps this studio tracks to start.')).toBeInTheDocument();
      expect(apps.getByRole('link', { name: 'Go to Apps' })).toHaveAttribute('href', '/apps');
    });

    it('tells everyone else that an admin has to add them', async () => {
      stubBackend(healthOf('seed'), appsOf([]));
      renderOverview({ role: 'growth' });
      const apps = card('Apps');

      expect(await apps.findByText('No apps yet')).toBeInTheDocument();
      expect(
        apps.getByText('An admin has to add the apps this studio tracks.'),
      ).toBeInTheDocument();
    });

    it('says when the list is not available, with the reason', async () => {
      stubBackend(healthOf('seed'), apiError(500, 'internal_error', 'Could not load the apps.'));
      renderOverview();
      const apps = card('Apps');

      expect(await apps.findByText('Not available')).toBeInTheDocument();
      expect(apps.getByText('Could not load the apps.')).toBeInTheDocument();
    });
  });

  describe('current view card', () => {
    it("shows the studio's usual range as days in the studio's time zone", async () => {
      setClockToMiddayInKolkata();
      stubBackend();
      renderOverview();
      const view = card('Current view');

      expect(view.getByText('Last 30 days')).toBeInTheDocument();
      expect(view.getByText('16 Sep 2026 – 15 Oct 2026 (Asia/Kolkata)')).toBeInTheDocument();
      expect(view.getByText('All apps')).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
    });

    it("uses the studio's own default range when the address names none", async () => {
      setClockToMiddayInKolkata();
      stubBackend();
      renderOverview({ studio: makeStudio({ defaultDateRange: '7d' }) });
      const view = card('Current view');

      expect(view.getByText('Last 7 days')).toBeInTheDocument();
      expect(view.getByText('9 Oct 2026 – 15 Oct 2026 (Asia/Kolkata)')).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
    });

    it('follows the range and the apps in the address', async () => {
      setClockToMiddayInKolkata();
      stubBackend();
      renderOverview({ route: '/?range=today&appIds=a1' });
      const view = card('Current view');

      expect(view.getByText('Today')).toBeInTheDocument();
      expect(view.getByText('15 Oct 2026 (Asia/Kolkata)')).toBeInTheDocument();
      expect(view.getByText('1 app chosen')).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
    });

    it('counts several chosen apps', async () => {
      stubBackend();
      renderOverview({ route: '/?appIds=a1%2Cb2' });

      expect(card('Current view').getByText('2 apps chosen')).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
    });

    it('shows a custom range exactly as chosen', async () => {
      stubBackend();
      renderOverview({ route: '/?range=custom&from=2026-10-01&to=2026-10-10' });
      const view = card('Current view');

      expect(view.getByText('Custom range')).toBeInTheDocument();
      expect(view.getByText('1 Oct 2026 – 10 Oct 2026 (Asia/Kolkata)')).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
    });

    it('cuts the day where the studio is, not where the browser is', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      // 20:00 UTC on the 15th is already the 16th in India and still the 15th in Los Angeles.
      vi.setSystemTime(new Date('2026-10-15T20:00:00Z'));
      stubBackend();

      const india = renderOverview({ route: '/?range=today' });
      expect(card('Current view').getByText('16 Oct 2026 (Asia/Kolkata)')).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
      india.unmount();

      renderOverview({
        route: '/?range=today',
        studio: makeStudio({ timezone: 'America/Los_Angeles' }),
      });
      expect(
        card('Current view').getByText('15 Oct 2026 (America/Los_Angeles)'),
      ).toBeInTheDocument();
      await card('Data source').findByText('Demo data');
    });
  });
});
