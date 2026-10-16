import type { StudioSettingsResponse } from '@growth/shared';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { apiFetch } from '../../lib/api';

export const STUDIO_KEY = ['studio'] as const;

/** Loads the studio's name, logo, time zone and defaults. Every role may read them. */
export function useStudioQuery(enabled = true) {
  return useQuery({
    queryKey: STUDIO_KEY,
    queryFn: () => apiFetch<StudioSettingsResponse>('/api/settings/studio'),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** The loaded settings. The app layout provides them once they have arrived, and not before. */
export const StudioContext = createContext<StudioSettingsResponse | null>(null);

export function useStudio(): StudioSettingsResponse {
  const value = useContext(StudioContext);
  if (!value) throw new Error('useStudio must be used inside the app layout');
  return value;
}
