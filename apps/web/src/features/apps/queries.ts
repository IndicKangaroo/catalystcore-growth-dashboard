import type { AppRecord, AppsResponse } from '@growth/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export const APPS_KEY = ['apps'] as const;

/** Every app, sorted by the API. Any role that can sign in may read the list. */
export function useApps() {
  return useQuery({
    queryKey: APPS_KEY,
    queryFn: async (): Promise<AppRecord[]> => (await apiFetch<AppsResponse>('/api/apps')).apps,
    staleTime: 60 * 1000,
  });
}
