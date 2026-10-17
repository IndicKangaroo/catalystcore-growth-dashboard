import { FILTER_PARAM_NAMES } from '@growth/shared';

/**
 * The filter part of an address, as a "?..." string (empty when no filter is set). Links between
 * screens carry it, so the date range and the apps chosen stay chosen when someone moves on.
 */
export function filterSearch(params: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const name of FILTER_PARAM_NAMES) {
    for (const value of params.getAll(name)) kept.append(name, value);
  }
  const text = kept.toString();
  return text ? `?${text}` : '';
}
