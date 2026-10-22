import type { DailyMetrics, SnapshotStore } from '../providers/ga4/types';

/** An in-memory `SnapshotStore` for tests. */
export function createMemorySnapshotStore(): SnapshotStore & {
  saved: Map<string, DailyMetrics & { propertyId: string }>;
} {
  const saved = new Map<string, DailyMetrics & { propertyId: string }>();
  return {
    saved,
    async read(appId, propertyId, from, to) {
      return [...saved.entries()]
        .filter(([key, day]) => key.startsWith(`${appId}_`) && day.propertyId === propertyId)
        .map(([, day]) => day)
        .filter((day) => day.date >= from && day.date <= to);
    },
    async write(appId, propertyId, days) {
      for (const day of days) saved.set(`${appId}_${day.date}`, { ...day, propertyId });
    },
  };
}
