/**
 * The small slice of the GA4 Data API that the provider uses. Naming it here keeps the Google
 * client in one file (`client.ts`) and lets the provider be tested with recorded answers.
 */
export interface Ga4ReportRequest {
  dateRanges?: { startDate: string; endDate: string; name?: string }[];
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  dimensionFilter?: unknown;
  cohortSpec?: unknown;
  limit?: number;
}

/** One row: the dimension values then the metric values, in the order they were asked for. */
export interface Ga4Row {
  dimensions: string[];
  metrics: string[];
}

export interface Ga4Report {
  rows: Ga4Row[];
}

export interface Ga4Client {
  runReport(propertyId: string, request: Ga4ReportRequest): Promise<Ga4Report>;
}

/** One finished day of one app's numbers, as kept in `metricSnapshots`. */
export interface DailyMetrics {
  date: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  /** Total seconds of engagement that day, so days can be averaged without losing weight. */
  engagementSeconds: number;
}

/**
 * Where finished days are remembered between requests (PLAN section 5, `metricSnapshots`). The
 * provider sees only this port, so it still never touches the database (D-033).
 */
export interface SnapshotStore {
  read(appId: string, propertyId: string, from: string, to: string): Promise<DailyMetrics[]>;
  write(appId: string, propertyId: string, days: DailyMetrics[]): Promise<void>;
}
