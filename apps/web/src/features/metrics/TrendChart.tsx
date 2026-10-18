import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCount, formatDay } from '../../lib/format';
import type { ChartRow } from './chartData';

// The chart takes its colours from the same tokens as the rest of the page, so it follows the
// light and dark themes without a second palette (D-038). This period is the accent, a solid line;
// the previous period is a quieter grey and dashed, so the two differ by shape and not only colour.
const THIS_PERIOD = 'var(--accent)';
const PREVIOUS_PERIOD = 'var(--text-subtle)';
const AXIS_TEXT = { fill: 'var(--text-muted)', fontSize: 12 } as const;

interface TooltipBodyProps {
  active?: boolean;
  row: ChartRow | undefined;
  label: string;
  comparing: boolean;
}

function TooltipBody({ active, row, label, comparing }: TooltipBodyProps) {
  if (!active || !row) return null;
  const write = (value: number | null) => (value === null ? 'No data' : formatCount(value));

  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-fg">{formatDay(row.date)}</p>
      <p className="mt-1 flex items-center gap-2 text-fg-muted">
        <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-accent" />
        {label}: <span className="font-medium text-fg">{write(row.current)}</span>
      </p>
      {comparing && (
        <p className="mt-0.5 flex items-center gap-2 text-fg-muted">
          <span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-fg-subtle" />
          {row.previousDate ? formatDay(row.previousDate) : 'Previous period'}:{' '}
          <span className="font-medium text-fg">{write(row.previous)}</span>
        </p>
      )}
    </div>
  );
}

/**
 * One metric over the days of a range, with the previous period dashed beneath it when comparing.
 * A day without data is a gap in the line, never a drop to zero. The numbers are also available as
 * a table next to the chart, so nothing here depends on seeing it.
 */
export function TrendChart({
  rows,
  comparing,
  label,
}: {
  rows: ChartRow[];
  comparing: boolean;
  label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={288}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: 'var(--border-strong)' }}
          tick={AXIS_TEXT}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={AXIS_TEXT}
          allowDecimals={false}
          tickFormatter={(value: number) => formatCount(value)}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          content={(props) => (
            <TooltipBody
              active={props.active}
              row={props.payload?.[0]?.payload as ChartRow | undefined}
              label={label}
              comparing={comparing}
            />
          )}
        />
        {comparing && (
          <Line
            dataKey="previous"
            stroke={PREVIOUS_PERIOD}
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, fill: PREVIOUS_PERIOD, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        )}
        <Line
          dataKey="current"
          stroke={THIS_PERIOD}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{ r: 4, fill: THIS_PERIOD, stroke: 'var(--surface)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
