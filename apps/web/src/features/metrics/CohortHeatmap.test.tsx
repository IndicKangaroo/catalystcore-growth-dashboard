import { metricMissing, metricOk } from '@growth/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCohort } from '../../test/metrics';
import { CohortHeatmap } from './CohortHeatmap';

describe('CohortHeatmap', () => {
  it('writes every percentage in the cell, so the shading is never the only signal', () => {
    render(<CohortHeatmap cohorts={[makeCohort()]} />);

    const row = within(screen.getByRole('row', { name: /28 Sep – 4 Oct/ }));
    expect(row.getByText('410')).toBeInTheDocument();
    expect(row.getByText('42.0%')).toBeInTheDocument();
    expect(row.getByText('21.0%')).toBeInTheDocument();
  });

  it('says "In progress" for a window that has not ended, never 0%', () => {
    render(<CohortHeatmap cohorts={[makeCohort()]} />);

    const row = within(screen.getByRole('row', { name: /28 Sep – 4 Oct/ }));
    expect(row.getAllByText('In progress')).toHaveLength(2);
    expect(row.queryByText(/^0/)).not.toBeInTheDocument();
  });

  it('says why another cell is empty, in words', () => {
    render(
      <CohortHeatmap
        cohorts={[
          makeCohort({
            retention: {
              d1: metricMissing('not_enough_data'),
              d7: metricMissing('not_connected'),
              d14: metricMissing('in_progress'),
              d30: metricMissing('in_progress'),
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('shows a real 0.0% as a number', () => {
    render(
      <CohortHeatmap
        cohorts={[
          makeCohort({
            retention: {
              d1: metricOk(0),
              d7: metricMissing('in_progress'),
              d14: metricMissing('in_progress'),
              d30: metricMissing('in_progress'),
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('has a row for each cohort and a column for each day', () => {
    render(
      <CohortHeatmap
        cohorts={[
          makeCohort(),
          makeCohort({ cohortStart: '2026-10-05', cohortEnd: '2026-10-11', users: 380 }),
        ]}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Installed in the week of',
      'New users',
      'Day 1',
      'Day 7',
      'Day 14',
      'Day 30',
    ]);
    expect(screen.getByRole('row', { name: /5 Oct – 11 Oct/ })).toBeInTheDocument();
  });

  it('says "Not enough data" when there are no cohorts', () => {
    render(<CohortHeatmap cohorts={[]} />);

    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
