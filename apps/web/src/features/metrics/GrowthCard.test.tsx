import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiError, stubApi } from '../../test/api';
import type { ApiReply, RecordedRequest } from '../../test/api';
import { readyState, renderWithSession } from '../../test/helpers';
import { makePoints, makeSeries, setClockToMiddayInKolkata, WEEK } from '../../test/metrics';
import { GrowthCard } from './GrowthCard';

vi.mock('../../lib/firebase', () => ({ getIdToken: vi.fn().mockResolvedValue(null) }));

function render(route = '/?range=7d&compare=off', appIds?: string[]) {
  setClockToMiddayInKolkata();
  return renderWithSession(<GrowthCard title="Growth" appIds={appIds} />, {
    state: readyState(),
    route,
  });
}

const reply =
  (body: unknown): ((request: RecordedRequest) => ApiReply) =>
  () => ({ body });

describe('GrowthCard', () => {
  it('shows the highest day beside the chart', async () => {
    stubApi({ '/api/metrics/series*': reply(makeSeries()) });
    render();

    const peak = await screen.findByText(/Highest day/);
    expect(peak).toHaveTextContent('Highest day: 15 Oct (160)');
    expect(
      screen.getByRole('img', { name: /Line chart of active users per day/ }),
    ).toBeInTheDocument();
  });

  it('offers the same numbers as a table, and says "No data" for a day without one', async () => {
    stubApi({
      '/api/metrics/series*': reply(
        makeSeries(
          'active_users',
          makePoints(WEEK, (index) => (index === 2 ? null : 100 + index)),
        ),
      ),
    });
    render();

    expect(await screen.findByText('Show as a table')).toBeInTheDocument();
    expect(screen.getByText('11 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('106')).toBeInTheDocument();
  });

  it('asks for the active users of the apps it is given', async () => {
    const requests = stubApi({ '/api/metrics/series*': reply(makeSeries()) });
    render('/?range=7d&compare=off&appIds=toolkit', ['quest']);
    await screen.findByText(/Highest day/);

    const path = requests[0]?.path ?? '';
    expect(path).toContain('appIds=quest');
    expect(path).not.toContain('toolkit');
    expect(path).toContain('metric=active_users');
  });

  it('follows the apps chosen in the filters when it is given none', async () => {
    const requests = stubApi({ '/api/metrics/series*': reply(makeSeries()) });
    render('/?range=7d&compare=off&appIds=toolkit');
    await screen.findByText(/Highest day/);

    expect(requests[0]?.path).toContain('appIds=toolkit');
  });

  it('switches metric', async () => {
    const requests = stubApi({
      '/api/metrics/series*': (request) => ({
        body: makeSeries(request.path.includes('metric=new_users') ? 'new_users' : 'active_users'),
      }),
    });
    render();
    await screen.findByText(/Highest day/);
    expect(screen.getByRole('button', { name: 'Active users' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'New users' }));

    await waitFor(() =>
      expect(requests.some((request) => request.path.includes('metric=new_users'))).toBe(true),
    );
    expect(screen.getByRole('button', { name: 'New users' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('says "No measured attribution available" for attributed users, with a Measured badge', async () => {
    stubApi({
      '/api/metrics/series*': (request) =>
        request.path.includes('metric=attributed_users')
          ? {
              body: {
                ...makeSeries('attributed_users'),
                data: { state: 'no_measured_attribution' },
              },
            }
          : { body: makeSeries() },
    });
    render();
    await screen.findByText(/Highest day/);

    fireEvent.click(screen.getByRole('button', { name: 'Attributed users (measured)' }));

    expect(await screen.findByText('No measured attribution available')).toBeInTheDocument();
    expect(screen.getByText('Measured')).toBeInTheDocument();
    expect(screen.queryByText(/Highest day/)).not.toBeInTheDocument();
  });

  it('says "Not connected" when the source has nothing to give', async () => {
    stubApi({
      '/api/metrics/series*': reply({ ...makeSeries(), data: { state: 'not_connected' } }),
    });
    render();

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
  });

  it('says "Not enough data" when no day has a number, instead of drawing zeros', async () => {
    stubApi({
      '/api/metrics/series*': reply(
        makeSeries(
          'active_users',
          makePoints(WEEK, () => null),
        ),
      ),
    });
    render();

    expect(await screen.findByText('Not enough data')).toBeInTheDocument();
    expect(screen.queryByText(/Highest day/)).not.toBeInTheDocument();
  });

  it('says what went wrong when the series cannot be read', async () => {
    stubApi({
      '/api/metrics/series*': apiError(500, 'internal_error', 'The chart numbers are unavailable.'),
    });
    render();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The chart numbers are unavailable.',
    );
  });

  describe('comparing', () => {
    it('shows a legend and a previous-period column, and asks for the days before', async () => {
      const requests = stubApi({ '/api/metrics/series*': reply(makeSeries()) });
      render('/?range=7d');

      expect(await screen.findByText('This period')).toBeInTheDocument();
      expect(screen.getAllByText('Previous period').length).toBeGreaterThan(0);
      expect(
        requests.some((request) => request.path.includes('from=2026-10-02&to=2026-10-08')),
      ).toBe(true);
    });

    it('has no legend when not comparing, and does not ask for the days before', async () => {
      const requests = stubApi({ '/api/metrics/series*': reply(makeSeries()) });
      render('/?range=7d&compare=off');
      await screen.findByText(/Highest day/);

      expect(screen.queryByText('This period')).not.toBeInTheDocument();
      expect(requests.some((request) => request.path.includes('from=2026-10-02'))).toBe(false);
    });

    it('keeps the chart when only the previous period fails, and says so', async () => {
      stubApi({
        '/api/metrics/series*': (request) =>
          request.path.includes('from=2026-10-02')
            ? apiError(500, 'internal_error', 'No earlier numbers.')
            : { body: makeSeries() },
      });
      render('/?range=7d');

      expect(
        await screen.findByText('The previous period could not be loaded.'),
      ).toBeInTheDocument();
      expect(screen.getByText(/Highest day/)).toBeInTheDocument();
      expect(screen.queryByText('This period')).not.toBeInTheDocument();
    });
  });
});
