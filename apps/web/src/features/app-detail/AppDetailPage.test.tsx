import { metricMissing, metricOk } from '@growth/shared';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiError, stubApi } from '../../test/api';
import type { ApiReply, RecordedRequest } from '../../test/api';
import { makeApp, readyState, renderWithSession } from '../../test/helpers';
import {
  WEEK_BEFORE,
  makeAppUsers,
  makeCohort,
  makeRetention,
  makeSeries,
  setClockToMiddayInKolkata,
} from '../../test/metrics';
import AppDetailPage from './AppDetailPage';

vi.mock('../../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

const QUEST = makeApp({
  id: 'quest',
  name: 'Grind Quest',
  packageName: 'com.example.quest',
  status: 'production',
});
const TOOLKIT = makeApp({ id: 'toolkit', name: 'PDF Toolkit' });

interface Backend {
  users?: ApiReply;
  before?: ApiReply;
  retention?: ApiReply;
  apps?: ApiReply;
}

function stubBackend({ users, before, retention, apps }: Backend = {}) {
  return stubApi({
    '/api/apps': apps ?? { body: { apps: [QUEST, TOOLKIT] } },
    '/api/apps/quest/users*': (request: RecordedRequest) =>
      request.path.includes(`from=${WEEK_BEFORE.from}`)
        ? (before ?? users ?? { body: makeAppUsers() })
        : (users ?? { body: makeAppUsers() }),
    '/api/apps/quest/retention*': retention ?? { body: makeRetention() },
    '/api/metrics/series*': { body: makeSeries() },
  });
}

function renderDetail(route = '/apps/quest?range=7d&compare=off') {
  setClockToMiddayInKolkata();
  return renderWithSession(
    <Routes>
      <Route path="/apps/:appId" element={<AppDetailPage />} />
    </Routes>,
    { state: readyState(), route },
  );
}

/** The card under a heading such as "DAU". */
function card(label: string): ReturnType<typeof within> {
  const heading = screen.getByRole('heading', { name: label });
  const element = heading.closest('.rounded-card');
  if (!(element instanceof HTMLElement)) throw new Error(`No card around the "${label}" heading`);
  return within(element);
}

describe('AppDetailPage', () => {
  it('names the app, its package and its status, and says the numbers are demo data', async () => {
    stubBackend();
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Grind Quest' })).toBeInTheDocument();
    expect(screen.getByText('com.example.quest')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(await screen.findByText('Demo data')).toBeInTheDocument();
  });

  it('shows the users of the app', async () => {
    stubBackend();
    renderDetail();
    await screen.findByRole('heading', { name: 'DAU' });

    expect(card('DAU').getByText('820')).toBeInTheDocument();
    expect(card('WAU').getByText('3,100')).toBeInTheDocument();
    expect(card('MAU').getByText('9,800')).toBeInTheDocument();
    expect(card('New users').getByText('1,200')).toBeInTheDocument();
    expect(card('Returning users').getByText('2,600')).toBeInTheDocument();
    expect(card('Sessions').getByText('21.5K')).toBeInTheDocument();
    expect(card('Sessions per user').getByText('2.5')).toBeInTheDocument();
    expect(card('Engagement per user').getByText('2m 05s')).toBeInTheDocument();
  });

  it('says what DAU, WAU and MAU cover', async () => {
    stubBackend();
    renderDetail();
    await screen.findByRole('heading', { name: 'DAU' });

    expect(card('DAU').getByText('Active on the last day of the range')).toBeInTheDocument();
    expect(card('MAU').getByText('Active in the 28 days to the last day')).toBeInTheDocument();
  });

  it('writes a missing number as the reason, never as 0', async () => {
    stubBackend({
      users: {
        body: makeAppUsers({
          mau: metricMissing('not_enough_data'),
          averageEngagementSeconds: metricMissing('not_connected'),
        }),
      },
    });
    renderDetail();
    await screen.findByRole('heading', { name: 'DAU' });

    expect(card('MAU').getByText('Not enough data')).toBeInTheDocument();
    expect(card('Engagement per user').getByText('Not connected')).toBeInTheDocument();
  });

  it('compares with the days before when asked to', async () => {
    stubBackend({
      users: { body: makeAppUsers({ dau: metricOk(820) }) },
      before: { body: makeAppUsers({ dau: metricOk(700) }) },
    });
    renderDetail('/apps/quest?range=7d');

    await screen.findByRole('heading', { name: 'DAU' });
    expect(await card('DAU').findByText('+17.1%')).toBeInTheDocument();
    expect(card('DAU').getByText('vs previous period')).toBeInTheDocument();
  });

  it('reads the app named in the address, whatever apps the filters chose', async () => {
    const requests = stubBackend();
    renderDetail('/apps/quest?range=7d&compare=off&appIds=toolkit');
    await screen.findByRole('heading', { name: 'DAU' });

    const users = requests.find((request) => request.path.startsWith('/api/apps/quest/users'));
    const series = requests.find((request) => request.path.startsWith('/api/metrics/series'));
    expect(users?.path).not.toContain('appIds');
    expect(series?.path).toContain('appIds=quest');
    expect(series?.path).not.toContain('toolkit');
  });

  describe('retention', () => {
    it('shows the summary for day 1, 7, 14 and 30, with a window that has not ended in words', async () => {
      stubBackend();
      renderDetail();
      await screen.findByRole('heading', { name: 'Retention' });

      await screen.findByRole('heading', { name: 'Day 1' });
      expect(await card('Day 1').findByText('40.0%')).toBeInTheDocument();
      expect(card('Day 7').getByText('20.0%')).toBeInTheDocument();
      expect(card('Day 14').getByText('In progress')).toBeInTheDocument();
      expect(card('Day 30').getByText('Not enough data')).toBeInTheDocument();
    });

    it('shows the cohorts in a heatmap', async () => {
      stubBackend({
        retention: {
          body: makeRetention({
            cohorts: [
              makeCohort(),
              makeCohort({ cohortStart: '2026-10-05', cohortEnd: '2026-10-11', users: 380 }),
            ],
          }),
        },
      });
      renderDetail();

      expect(await screen.findByRole('row', { name: /28 Sep – 4 Oct/ })).toBeInTheDocument();
      expect(screen.getByRole('row', { name: /5 Oct – 11 Oct/ })).toBeInTheDocument();
    });

    it('says what went wrong when retention cannot be read, and keeps the users', async () => {
      stubBackend({ retention: apiError(500, 'internal_error', 'Retention is unavailable.') });
      renderDetail();

      expect(await screen.findByText('Retention is unavailable.')).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'DAU' })).toBeInTheDocument();
    });
  });

  it('has the growth chart for this app', async () => {
    stubBackend();
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Growth' })).toBeInTheDocument();
    expect(await screen.findByText(/Highest day/)).toBeInTheDocument();
  });

  describe('an app that is not there', () => {
    it('says so and links back, and asks for no numbers', async () => {
      const requests = stubBackend();
      renderDetail('/apps/nope?range=7d');

      expect(await screen.findByRole('heading', { name: 'App not found' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '← All apps' })).toHaveAttribute(
        'href',
        '/apps?range=7d',
      );
      expect(screen.queryByRole('heading', { name: 'DAU' })).not.toBeInTheDocument();
      expect(requests.some((request) => request.path.includes('/nope/'))).toBe(false);
    });

    it('says what went wrong when the app list cannot be read', async () => {
      stubBackend({ apps: apiError(500, 'internal_error', 'The apps are unavailable.') });
      renderDetail();

      expect(await screen.findByRole('alert')).toHaveTextContent('The apps are unavailable.');
    });
  });

  it('links back to the Apps list, keeping the filters', async () => {
    stubBackend();
    renderDetail('/apps/quest?range=7d&compare=off');

    expect(await screen.findByRole('link', { name: '← All apps' })).toHaveAttribute(
      'href',
      '/apps?range=7d',
    );
  });
});
