import { changeBetween } from '@growth/shared';
import type { MetricValue } from '@growth/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Card } from '../../components/Card';
import { formatSignedPercent } from '../../lib/format';
import { metricText } from './metricText';

/** How the comparison with the previous period stands: still loading, failed, or ready. */
// Three short names instead of one long union: the formatter lays out a union that does not fit on
// a line differently from one version to the next, and a one-line union has no such choice.
type ComparisonLoading = { status: 'loading' };
type ComparisonFailed = { status: 'failed' };
type ComparisonReady = { status: 'ready'; previous: MetricValue };
export type Comparison = ComparisonLoading | ComparisonFailed | ComparisonReady;

/** The comparison for one number, or undefined while the screen is not comparing. */
export function comparisonFrom<T>(
  comparing: boolean,
  query: Pick<UseQueryResult<T>, 'data' | 'isError'>,
  pick: (data: T) => MetricValue,
): Comparison | undefined {
  if (!comparing) return undefined;
  if (query.isError) return { status: 'failed' };
  if (query.data === undefined) return { status: 'loading' };
  return { status: 'ready', previous: pick(query.data) };
}

// Words for why there is no percentage. "No current" has none: the card's own number already says
// why it is missing.
const NO_CHANGE_WORDS = {
  no_current: null,
  no_previous: 'No data for the previous period',
  previous_zero: 'None in the previous period',
} as const;

function ChangeLine({ value, comparison }: { value: MetricValue; comparison: Comparison }) {
  const small = 'text-xs text-fg-subtle';
  if (comparison.status === 'loading') return <p className={small}>Comparing…</p>;
  if (comparison.status === 'failed') return <p className={small}>Comparison not available</p>;

  const change = changeBetween(value, comparison.previous);
  if (change.kind === 'none') {
    const words = NO_CHANGE_WORDS[change.reason];
    return words ? <p className={small}>{words}</p> : null;
  }

  // The sign and the arrow carry the direction; the colour only backs them up.
  const rounded = Math.round(change.fraction * 1000);
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '–';
  const tone =
    rounded > 0 ? 'text-ok-strong' : rounded < 0 ? 'text-danger-strong' : 'text-fg-muted';
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
      <span className={`font-medium ${tone}`}>
        <span aria-hidden="true">{arrow} </span>
        {formatSignedPercent(change.fraction)}
      </span>
      <span className="text-fg-subtle">vs previous period</span>
    </p>
  );
}

interface MetricCardProps {
  label: string;
  value: MetricValue;
  format: (value: number) => string;
  /** Left out when the screen is not comparing. */
  comparison?: Comparison;
  /** A short line under the number, such as what it is summed over. */
  note?: string;
  /** Shown beside the label, such as a provenance badge. */
  badge?: ReactNode;
}

/**
 * One number with its label (the design's metric card). A number that is missing is written as the
 * reason in words, smaller and muted, so it can never be read as a real zero.
 */
export function MetricCard({ label, value, format, comparison, note, badge }: MetricCardProps) {
  const { text, missing } = metricText(value, format);

  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium text-fg-muted">{label}</h3>
        {badge}
      </div>
      {missing ? (
        <p className="text-sm font-medium text-fg-muted">{text}</p>
      ) : (
        <p className="text-[28px] leading-8 font-semibold tracking-tight text-fg">{text}</p>
      )}
      {note && <p className="text-xs text-fg-subtle">{note}</p>}
      {comparison && <ChangeLine value={value} comparison={comparison} />}
    </Card>
  );
}
