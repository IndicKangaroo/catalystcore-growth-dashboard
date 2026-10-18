import type { Retention } from '@growth/shared';
import { formatCount, formatPercent, formatShortDay } from '../../lib/format';
import { heatAlpha } from './heat';
import { MISSING_LABELS } from './metricText';

const DAYS = [
  { key: 'd1', label: 'Day 1' },
  { key: 'd7', label: 'Day 7' },
  { key: 'd14', label: 'Day 14' },
  { key: 'd30', label: 'Day 30' },
] as const;

type Cohort = Retention['cohorts'][number];
type Cell = Cohort['retention']['d1'];

function RetentionCell({ cell }: { cell: Cell }) {
  if (cell.state !== 'ok') {
    // A window that has not ended yet is "In progress", never 0%. The dashed outline marks a
    // missing number by shape, so it does not depend on colour either.
    return (
      <td className="px-3 py-2 text-center">
        <span className="inline-block rounded-chip border border-dashed border-line-strong px-1.5 py-0.5 text-[11px] text-fg-subtle">
          {MISSING_LABELS[cell.state]}
        </span>
      </td>
    );
  }
  const strength = Math.round(heatAlpha(cell.value) * 100);
  return (
    <td
      className="px-3 py-2 text-center font-medium tabular-nums text-fg"
      style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${strength}%, transparent)` }}
    >
      {formatPercent(cell.value)}
    </td>
  );
}

/**
 * Retention by weekly install cohort (D-006): one row per week of installs, one column per day
 * after install. Every cell says its percentage in writing; the shading only helps the eye.
 */
export function CohortHeatmap({ cohorts }: { cohorts: Retention['cohorts'] }) {
  if (cohorts.length === 0) {
    return <p className="py-6 text-center font-medium text-fg-muted">Not enough data</p>;
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[32rem] border-separate border-spacing-0 text-left text-[13px]">
        <caption className="sr-only">
          Retention by weekly install cohort: the share of each week&rsquo;s new users who came back
          on day 1, 7, 14 and 30
        </caption>
        <thead>
          <tr className="text-[11px] font-semibold tracking-[0.04em] text-fg-subtle uppercase">
            <th scope="col" className="border-b border-line px-3 py-2">
              Installed in the week of
            </th>
            <th scope="col" className="border-b border-line px-3 py-2 text-right">
              New users
            </th>
            {DAYS.map((day) => (
              <th key={day.key} scope="col" className="border-b border-line px-3 py-2 text-center">
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortStart}>
              <th
                scope="row"
                className="border-b border-line px-3 py-2 font-normal whitespace-nowrap text-fg"
              >
                {formatShortDay(cohort.cohortStart)} – {formatShortDay(cohort.cohortEnd)}
              </th>
              <td className="border-b border-line px-3 py-2 text-right tabular-nums text-fg-muted">
                {formatCount(cohort.users)}
              </td>
              {DAYS.map((day) => (
                <RetentionCell key={day.key} cell={cohort.retention[day.key]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
