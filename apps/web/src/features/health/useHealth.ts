import type { HealthResponse } from '@growth/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export const HEALTH_KEY = ['health'] as const;

/** Which data source the API is reading from. The route is public, so this needs no sign-in. */
export function useHealth() {
  return useQuery({
    queryKey: HEALTH_KEY,
    queryFn: () => apiFetch<HealthResponse>('/api/health'),
    staleTime: 60 * 1000,
    retry: false,
  });
}
