import { previousRange } from '@growth/shared';
import { formatDayRange } from '../../lib/format';
import { useFilters } from '../filters/useFilters';
import { useCompare } from './useCompare';

/** The "compare to previous period" switch, with the days it compares against written out. */
export function CompareControl() {
  const { compare, setCompare } = useCompare();
  const { range } = useFilters();

  return (
    <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
      <label className="inline-flex items-center gap-2 text-fg-muted">
        <input
          type="checkbox"
          checked={compare}
          onChange={(event) => setCompare(event.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Compare to previous period
      </label>
      {compare && <span className="text-fg-subtle">{formatDayRange(previousRange(range))}</span>}
    </div>
  );
}
