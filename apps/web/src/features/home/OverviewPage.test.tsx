import type { Overview, Role, StudioSettingsResponse } from '@growth/shared';
import { metricMissing, metricOk } from '@growth/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiError, stubApi } from '../../test/api';
import type { ApiReply, RecordedRequest } from '../../test/api';
import { makeApp, makeStudio, readyState, renderWithSession } from '../../test/helpers';
import {
  WEEK_BEFORE,
  makeOverview,
  makePoints,
  makeSeries,
  setClockToMiddayInKolkata,
} from '../../test/metrics';
import OverviewPage from './OverviewPage';

// The screen reads through the real apiFetch; only the sign-in token is faked.
vi.mock('../../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

const QUEST = makeApp({ id: 'quest', name: 'Grind Quest', packageName: 'com.example.quest' });
const TOOLKIT = makeApp({ id: 'toolkit', name: 'PDF Toolkit', status: 'testing' });

interface Backend {
  apps?: ReturnType<typeof makeApp>[];
  overview?: Overview;
  /** What the previous period answers, when it differs from the current one. */
  before?: Overview;
  overviewReply?: ApiReply;
}

function stubBackend({ apps = [QUEST, TOOLKIT], overview, before, overviewReply }: Backend = {}) {
  const current = overview ?? makeOverview();
  return stubApi({
    '/api/apps': { body: { apps } },
    '/api/metrics/overview*': (request: RecordedRequest) =>
      overviewReply ?? {
        body: request.path.includes(`from=${WEEK_BEFORE.from}`) ? (before ?? current) : current,
      },
    '/api/metrics/series*': {
      body: makeSeries('active_users', makePoints({ from: '2026-10-09', to: '2026-10-15' })),
    },
  });
}

interface Options {
  role?: Role;
  name?: string | null;
  route?: string;
  studio?: StudioSettingsResponse;
}

function renderOverview({
  role = 'admin',
  name = 'Ada Admin',
  route = '/?range=7d',
  studio,
}: Options = {}) {
  setClockToMiddayInKolkata();
  return renderWithSession(<OverviewPage />, {
    state: readyState(role, 'ada@example.com', name),
    route,
    studio,
  });
}

/** The card under a key-number heading such as "Active users". */
function card(label: string): ReturnType<typeof within> {
  const heading = screen.getByRole('heading', { name: label });
  const element = heading.closest('.rounded-card');
  if (!(element instanceof HTMLElement)) throw new Error(`No card around the "${label}" heading`);
  return within(element);
}

describe('OverviewPage', () => {
  it('welcomes the person by name and shows the key numbers', async () => {
    stubBackend();
    renderOverview({ name: 'Ada Admin' });

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Ada Admin\./)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Active users' })).toBeInTheDocument();
    expect(card('Active users').getByText('12.9K')).toBeInTheDocument();
    expect(card('New users').getByText('3,400')).toBeInTheDocument();
    expect(card('Sessions').getByText('48.2K')).toBeInTheDocument();
    expect(card('Day-7 retention').getByText('23.4%')).toBeInTheDocument();
  });

  it('welcomes a person who has no name on their account by their email address', async () => {
    stubBackend();
    renderOverview({ role: 'growth', name: null });

    expect(screen.getByText(/Welcome, ada@example\.com\./)).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Active users' });
  });

  it('labels demo data on the screen, from what the answer says its source is', async () => {
    stubBackend({ overview: makeOverview({ source: 'seed' }) });
    renderOverview();

    expect(await screen.findByText('Demo data')).toBeInTheDocument();
  });

  it('names Google Analytics 4 and no demo label for real analytics', async () => {
    stubBackend({ overview: makeOverview({ source: 'ga4' }) });
    renderOverview();

    expect(await screen.findByText('Google Analytics 4')).toBeInTheDocument();
    expect(screen.queryByText('Demo data')).not.toBeInTheDocument();
  });

  describe('numbers that are missing', () => {
    it('says why in words and never shows them as 0', async () => {
      stubBackend({
        overview: makeOverview({
          installs: metricMissing('not_connected'),
          averageRetention: metricMissing('in_progress'),
          newUsers: metricMissing('not_enough_data'),
          attributedUsers: metricMissing('no_measured_attribution'),
        }),
      });
      renderOverview();
      await screen.findByRole('heading', { name: 'Active users' });

      expect(card('Installs').getByText('Not connected')).toBeInTheDocument();
      expect(card('Day-7 retention').getByText('In progress')).toBeInTheDocument();
      expect(card('New users').getByText('Not enough data')).toBeInTheDocument();
      expect(
        card('Attributed users').getByText('No measured attribution available'),
      ).toBeInTheDocument();
      for (const label of ['Installs', 'Day-7 retention', 'New users', 'Attributed users']) {
        expect(card(label).queryByText(/^0/)).not.toBeInTheDocument();
      }
    });

    it('still shows a real zero as 0', async () => {
      stubBackend({ overview: makeOverview({ newUsers: metricOk(0) }) });
      renderOverview({ route: '/?range=7d&compare=off' });
      await screen.findByRole('heading', { name: 'Active users' });

      expect(card('New users').getByText('0')).toBeInTheDocument();
    });
  });

  it('badges attributed users as measured, because only measured attribution is a headline', async () => {
    stubBackend({ overview: makeOverview({ attributedUsers: metricOk(120) }) });
    renderOverview();
    await screen.findByRole('heading', { name: 'Attributed users' });

    expect(card('Attributed users').getByText('Measured')).toBeInTheDocument();
    expect(card('Attributed users').getByText('120')).toBeInTheDocument();
  });

  it('says which apps are not in the numbers', async () => {
    stubBackend({ overview: makeOverview({ appsNotConnected: ['PDF Toolkit'] }) });
    renderOverview();

    expect(await screen.findByText('Some apps are not in these numbers.')).toBeInTheDocument();
    expect(screen.getByText('Not connected: PDF Toolkit.')).toBeInTheDocument();
  });

  describe('compare to previous period', () => {
    it('compares with the same number of days directly before, by default', async () => {
      const requests = stubBackend({
        overview: makeOverview({ activeUsers: metricOk(12_900) }),
        before: makeOverview({ activeUsers: metricOk(10_000) }),
      });
      renderOverview();

      expect(await card('Active users').findByText('+29.0%')).toBeInTheDocument();
      expect(card('Active users').getByText('vs previous period')).toBeInTheDocument();
      const asked = requests.map((request) => request.path);
      expect(asked.some((path) => path.includes('from=2026-10-09&to=2026-10-15'))).toBe(true);
      expect(asked.some((path) => path.includes('from=2026-10-02&to=2026-10-08'))).toBe(true);
    });

    it('shows a fall as a fall', async () => {
      stubBackend({
        overview: makeOverview({ sessions: metricOk(900) }),
        before: makeOverview({ sessions: metricOk(1_000) }),
      });
      renderOverview();

      expect(await card('Sessions').findByText('-10.0%')).toBeInTheDocument();
    });

    it('says so in words when the previous period has no data, and gives no percentage', async () => {
      stubBackend({
        before: makeOverview({ activeUsers: metricMissing('not_enough_data') }),
      });
      renderOverview();

      expect(
        await card('Active users').findByText('No data for the previous period'),
      ).toBeInTheDocument();
      expect(card('Active users').queryByText(/%/)).not.toBeInTheDocument();
    });

    it('does not divide by a previous period of zero', async () => {
      stubBackend({ before: makeOverview({ newUsers: metricOk(0) }) });
      renderOverview();

      expect(await card('New users').findByText('None in the previous period')).toBeInTheDocument();
    });

    it('can be switched off, and then does not ask for the previous period at all', async () => {
      const requests = stubBackend();
      renderOverview({ route: '/?range=7d&compare=off' });
      await screen.findByRole('heading', { name: 'Active users' });

      expect(screen.queryByText('vs previous period')).not.toBeInTheDocument();
      expect(requests.some((request) => request.path.includes(`from=${WEEK_BEFORE.from}`))).toBe(
        false,
      );
      expect(
        screen.getByRole('checkbox', { name: 'Compare to previous period' }),
      ).not.toBeChecked();
    });

    it('is switched on and off with the checkbox', async () => {
      stubBackend();
      renderOverview();
      await screen.findByRole('heading', { name: 'Active users' });
      const box = screen.getByRole('checkbox', { name: 'Compare to previous period' });
      expect(box).toBeChecked();
      expect(screen.getByText('2 Oct 2026 – 8 Oct 2026')).toBeInTheDocument();

      fireEvent.click(box);

      expect(box).not.toBeChecked();
      expect(screen.queryByText('2 Oct 2026 – 8 Oct 2026')).not.toBeInTheDocument();
    });
  });

  describe('the apps in this view', () => {
    it('lists every app, each linking to its own page and keeping the filters', async () => {
      stubBackend();
      renderOverview({ route: '/?range=7d' });

      const link = await screen.findByRole('link', { name: 'Grind Quest' });
      expect(link).toHaveAttribute('href', '/apps/quest?range=7d');
      expect(screen.getByRole('link', { name: 'PDF Toolkit' })).toHaveAttribute(
        'href',
        '/apps/toolkit?range=7d',
      );
    });

    it('lists only the apps that were chosen', async () => {
      stubBackend();
      renderOverview({ route: '/?range=7d&appIds=toolkit' });

      expect(await screen.findByRole('link', { name: 'PDF Toolkit' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Grind Quest' })).not.toBeInTheDocument();
    });
  });

  describe('when there is nothing to show', () => {
    it('invites an admin to add the first apps, and asks the API for no numbers', async () => {
      const requests = stubBackend({ apps: [] });
      renderOverview({ role: 'admin' });

      expect(await screen.findByText('No apps yet')).toBeInTheDocument();
      expect(screen.getByText('Add the apps this studio tracks to start.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go to Apps' })).toHaveAttribute(
        'href',
        '/apps?range=7d',
      );
      expect(requests.some((request) => request.path.startsWith('/api/metrics'))).toBe(false);
    });

    it('tells everyone else that an admin has to add them', async () => {
      stubBackend({ apps: [] });
      renderOverview({ role: 'growth' });

      expect(
        await screen.findByText('An admin has to add the apps this studio tracks.'),
      ).toBeInTheDocument();
    });

    it('says what went wrong when the numbers cannot be read', async () => {
      stubBackend({
        overviewReply: apiError(500, 'internal_error', 'The numbers are unavailable.'),
      });
      renderOverview();

      expect(await screen.findByRole('alert')).toHaveTextContent('The numbers are unavailable.');
      expect(screen.queryByRole('heading', { name: 'Active users' })).not.toBeInTheDocument();
    });
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
      await screen.findByRole('heading', { name: 'Active users' });
    });

    it('says nothing once they are saved', async () => {
      stubBackend();
      renderOverview({ studio: makeStudio({ name: 'Orbit Studio' }, true) });

      await screen.findByRole('heading', { name: 'Active users' });
      expect(
        screen.queryByText('The studio settings have not been saved yet.'),
      ).not.toBeInTheDocument();
    });
  });

  it("asks for the days in the studio's time zone, not the browser's", async () => {
    const requests = stubBackend();
    renderOverview({ route: '/?range=today' });
    await screen.findByRole('heading', { name: 'Active users' });

    expect(requests.some((request) => request.path.includes('from=2026-10-15&to=2026-10-15'))).toBe(
      true,
    );
  });
});
