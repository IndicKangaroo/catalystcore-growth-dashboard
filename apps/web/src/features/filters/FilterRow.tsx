import { rangeProblem } from '@growth/shared';
import type { DateRange } from '@growth/shared';
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { TextField } from '../../components/fields';
import type { FilterScope } from '../../components/navigation';
import { useApps } from '../apps/queries';
import { useFilters } from './useFilters';

/** The two date boxes that appear while "Custom" is the chosen range. */
function CustomRangeFields({ from, to }: DateRange) {
  const { filters, setFilters } = useFilters();
  const [draft, setDraft] = useState<DateRange>({ from, to });
  const [problem, setProblem] = useState<string | null>(null);

  // The address can change under us (Back, a pasted link); show the dates it now holds.
  useEffect(() => {
    setDraft({ from, to });
    setProblem(null);
  }, [from, to]);

  function change(next: DateRange) {
    setDraft(next);
    const found = rangeProblem(next);
    setProblem(found);
    // Only a range that makes sense reaches the address, so nothing downstream sees a bad one.
    if (!found) setFilters({ ...filters, range: { kind: 'custom', ...next } });
  }

  return (
    <div role="group" aria-label="Custom date range" className="flex flex-wrap items-start gap-3">
      <TextField
        id="range-from"
        label="From"
        type="date"
        value={draft.from}
        onChange={(event) => change({ ...draft, from: event.target.value })}
        className="w-40"
      />
      <TextField
        id="range-to"
        label="To"
        type="date"
        value={draft.to}
        onChange={(event) => change({ ...draft, to: event.target.value })}
        error={problem ?? undefined}
        className="w-40"
      />
    </div>
  );
}

function AppChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-control border border-line bg-surface px-3 text-xs font-medium text-fg-muted transition-colors hover:text-fg aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent"
    >
      {pressed && <Icon name="check" />}
      {children}
    </button>
  );
}

/** One chip per app, for narrowing the screen to some apps. No chip selected means every app. */
function AppFilter() {
  const { filters, setFilters } = useFilters();
  const apps = useApps();
  const list = apps.data ?? [];

  if (list.length === 0) return null;

  function toggle(id: string) {
    const next = filters.appIds.includes(id)
      ? filters.appIds.filter((chosen) => chosen !== id)
      : [...filters.appIds, id];
    setFilters({ ...filters, appIds: next });
  }

  return (
    <div role="group" aria-labelledby="app-filter-label" className="flex flex-col gap-1.5">
      <span id="app-filter-label" className="text-xs font-medium text-fg">
        Apps
      </span>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <AppChip
          pressed={filters.appIds.length === 0}
          onClick={() => setFilters({ ...filters, appIds: [] })}
        >
          All apps
        </AppChip>
        {list.map((app) => (
          <AppChip
            key={app.id}
            pressed={filters.appIds.includes(app.id)}
            onClick={() => toggle(app.id)}
          >
            {app.name}
          </AppChip>
        ))}
      </div>
    </div>
  );
}

/**
 * The filters that need more room than the top bar: the custom dates and the app chips, in a strip
 * under the top bar. Renders nothing when the screen uses neither.
 */
export function FilterRow({ scope }: { scope: FilterScope }) {
  const { filters, setFilters } = useFilters();
  const apps = useApps();

  // An app that was deleted can still be named in an old link; drop it once the list has loaded, so
  // no screen waits on an app that is gone. This also holds when no app is left at all.
  useEffect(() => {
    const data = apps.data;
    if (!data) return;
    const known = filters.appIds.filter((id) => data.some((app) => app.id === id));
    if (known.length !== filters.appIds.length) setFilters({ ...filters, appIds: known });
  }, [apps.data, filters, setFilters]);

  const custom = scope !== 'none' && filters.range.kind === 'custom' ? filters.range : null;
  const showApps = scope === 'range-and-apps' && (apps.data?.length ?? 0) > 0;

  if (!custom && !showApps) return null;

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start gap-x-8 gap-y-3 px-4 py-3 lg:px-8">
        {custom && <CustomRangeFields from={custom.from} to={custom.to} />}
        {showApps && <AppFilter />}
      </div>
    </div>
  );
}
