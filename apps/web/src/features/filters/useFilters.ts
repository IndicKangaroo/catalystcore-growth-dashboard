import { mergeFilterParams, parseFilters, resolveDateRange } from '@growth/shared';
import type { DatePreset, DateRange, FilterState } from '@growth/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStudio } from '../studio/studio';

export interface FilterControls {
  filters: FilterState;
  /** The chosen range as calendar days in the studio's time zone, both ends included. */
  range: DateRange;
  /** The studio's usual range, which the address leaves out. */
  defaultPreset: DatePreset;
  timeZone: string;
  setFilters: (next: FilterState) => void;
}

/**
 * The global filters, kept in the address (`?range=7d&appIds=...`) so a link shows what its sender
 * saw and the back button works. The studio's settings give the time zone that turns "last 7 days"
 * into days, and the range used when the address names none.
 */
export function useFilters(): FilterControls {
  const { settings } = useStudio();
  const [params, setParams] = useSearchParams();
  const { defaultDateRange: defaultPreset, timezone: timeZone } = settings;

  const filters = useMemo(() => parseFilters(params, defaultPreset), [params, defaultPreset]);
  const range = resolveDateRange(filters.range, new Date(), timeZone);

  const setFilters = useCallback(
    (next: FilterState) => {
      // Replace rather than add a history entry, so Back goes to the previous screen and not
      // through every chip that was clicked.
      setParams((current) => mergeFilterParams(current, next, defaultPreset), { replace: true });
    },
    [setParams, defaultPreset],
  );

  return { filters, range, defaultPreset, timeZone, setFilters };
}
