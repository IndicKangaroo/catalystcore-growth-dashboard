import { previousRange, toApiQuery } from '@growth/shared';
import type {
  AppUsers,
  DateRange,
  FilterState,
  Metric,
  Overview,
  Retention,
  Series,
} from '@growth/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useFilters } from '../filters/useFilters';

/**
 * The query string for an analytics read over `range`. `appIds` overrides the apps chosen in the
 * filters: a list names exactly those apps, and an empty list leaves the apps out (a read that
 * already names its app in the path).
 */
export function periodQuery(
  filters: FilterState,
  range: DateRange,
  timeZone: string,
  appIds?: readonly string[],
): string {
  const params = toApiQuery(filters, new Date(), timeZone);
  params.set('from', range.from);
  params.set('to', range.to);
  if (appIds) {
    if (appIds.length > 0) params.set('appIds', appIds.join(','));
    else params.delete('appIds');
  }
  return params.toString();
}

/** The reads a screen makes for the chosen days and for the days before them (D-039). */
export function useViewQueries(appIds?: readonly string[]) {
  const { filters, range, timeZone } = useFilters();
  const previous = previousRange(range);
  return {
    range,
    previous,
    current: periodQuery(filters, range, timeZone, appIds),
    before: periodQuery(filters, previous, timeZone, appIds),
  };
}

const STALE = 60 * 1000;

export function useOverview(query: string, enabled = true) {
  return useQuery({
    queryKey: ['metrics', 'overview', query],
    queryFn: () => apiFetch<Overview>(`/api/metrics/overview?${query}`),
    enabled,
    staleTime: STALE,
  });
}

export function useSeries(query: string, metric: Metric, enabled = true) {
  return useQuery({
    queryKey: ['metrics', 'series', metric, query],
    queryFn: () => apiFetch<Series>(`/api/metrics/series?${query}&metric=${metric}`),
    enabled,
    staleTime: STALE,
  });
}

export function useAppUsers(appId: string, query: string, enabled = true) {
  return useQuery({
    queryKey: ['metrics', 'users', appId, query],
    queryFn: () => apiFetch<AppUsers>(`/api/apps/${encodeURIComponent(appId)}/users?${query}`),
    enabled,
    staleTime: STALE,
  });
}

export function useRetention(appId: string, query: string, enabled = true) {
  return useQuery({
    queryKey: ['metrics', 'retention', appId, query],
    queryFn: () => apiFetch<Retention>(`/api/apps/${encodeURIComponent(appId)}/retention?${query}`),
    enabled,
    staleTime: STALE,
  });
}
