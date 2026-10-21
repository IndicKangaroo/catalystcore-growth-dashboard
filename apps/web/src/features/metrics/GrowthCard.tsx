import { METRIC_LABELS } from '@growth/shared';
import type { Metric } from '@growth/shared';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '../../components/Card';
import { Notice } from '../../components/Notice';
import { ProvenanceBadge } from '../../components/ProvenanceBadge';
import { formatCount, formatDay, formatDayRange, formatShortDay } from '../../lib/format';
import { buildRows, peakOf } from './chartData';
import { MISSING_LABELS } from './metricText';
import { useSeries, useViewQueries } from './queries';
import { TrendChart } from './TrendChart';
import { useCompare } from './useCompare';

/** The metrics the growth chart offers. Engagement time is a per-person average and has no total. */
const CHART_METRICS: readonly Metric[] = [
  'active_users',
  'new_users',
  'sessions',
  'attributed_users',
];

function MetricPicker({
  selected,
  onPick,
}: {
  selected: Metric;
  onPick: (metric: Metric) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Metric"
      className="inline-flex max-w-full flex-wrap items-center rounded-control border border-line bg-muted p-0.5"
    >
      {CHART_METRICS.map((metric) => (
        <button
          key={metric}
          type="button"
          aria-pressed={selected === metric}
          onClick={() => onPick(metric)}
          className="h-8 whitespace-nowrap rounded-[8px] px-2.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-fg aria-pressed:shadow-card"
        >
          {METRIC_LABELS[metric]}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-fg-muted">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-accent" />
        This period
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-0 w-5 border-t-2 border-dashed border-fg-subtle" />
        Previous period
      </li>
    </ul>
  );
}

/**
 * The growth chart: one metric per day over the chosen range, for the apps given (or the apps
 * chosen in the filters), with the previous period dashed beneath it when comparing (D-039).
 */
export function GrowthCard({ appIds, title }: { appIds?: readonly string[]; title: string }) {
  const [metric, setMetric] = useState<Metric>('active_users');
  const { compare } = useCompare();
  const queries = useViewQueries(appIds);
  const current = useSeries(queries.current, metric);
  const before = useSeries(queries.before, metric, compare);

  const label = METRIC_LABELS[metric];
  const answer = current.data?.data;
  const points = answer?.state === 'ok' ? answer.points : null;
  const earlier = before.data?.data;
  const previousPoints = earlier?.state === 'ok' ? earlier.points : null;
  const peak = points ? peakOf(points) : null;
  const rows = points ? buildRows(points, compare ? previousPoints : null) : [];
  const comparing = compare && previousPoints !== null;

  let body: ReactNode;
  if (current.isPending) {
    body = (
      <p role="status" className="py-16 text-center text-fg-muted">
        Loading the chart…
      </p>
    );
  } else if (current.isError) {
    body = <Notice tone="danger">{current.error.message}</Notice>;
  } else if (current.data.data.state !== 'ok') {
    body = (
      <p className="py-16 text-center font-medium text-fg-muted">
        {MISSING_LABELS[current.data.data.state]}
      </p>
    );
  } else if (peak === null) {
    body = (
      <p className="py-16 text-center font-medium text-fg-muted">
        {MISSING_LABELS.not_enough_data}
      </p>
    );
  } else {
    body = (
      <>
        <div
          role="img"
          aria-label={`Line chart of ${label.toLowerCase()} per day, ${formatDayRange(queries.range)}. The highest day was ${formatDay(peak.date)}. The same numbers are in the table below.`}
        >
          <TrendChart rows={rows} comparing={comparing} label={label} />
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-fg-muted hover:text-fg">Show as a table</summary>
          <div
            role="region"
            aria-label="Chart data"
            tabIndex={0}
            className="relative mt-2 max-h-72 overflow-auto rounded-control border border-line"
          >
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-canvas text-fg-subtle">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Day
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {label}
                  </th>
                  {comparing && (
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Previous period
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.date}>
                    <th scope="row" className="px-3 py-1.5 font-normal text-fg-muted">
                      {formatDay(row.date)}
                    </th>
                    <td className="px-3 py-1.5 tabular-nums text-fg">
                      {row.current === null ? 'No data' : formatCount(row.current)}
                    </td>
                    {comparing && (
                      <td className="px-3 py-1.5 tabular-nums text-fg-muted">
                        {row.previous === null ? 'No data' : formatCount(row.previous)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
            {metric === 'attributed_users' && <ProvenanceBadge provenance="measured" />}
          </div>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {label}, per day · {formatDayRange(queries.range)}
          </p>
        </div>
        <MetricPicker selected={metric} onPick={setMetric} />
      </div>

      {compare && comparing && (
        <div className="mt-3">
          <Legend />
        </div>
      )}
      {compare && before.isError && (
        <p className="mt-3 text-xs text-fg-subtle">The previous period could not be loaded.</p>
      )}
      {peak && (
        <p className="mt-3 text-xs text-fg-muted">
          Highest day: <span className="font-medium text-fg">{formatShortDay(peak.date)}</span>
          {peak.value !== null && ` (${formatCount(peak.value)})`}
        </p>
      )}

      <div className="mt-2">{body}</div>
    </Card>
  );
}
