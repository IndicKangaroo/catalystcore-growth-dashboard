import type { Ga4Client, Ga4Report, Ga4Row, Ga4ReportRequest } from './types';

/** A GA4 client that answers from a function and remembers what it was asked. */
export function fakeGa4Client(
  answer: (propertyId: string, request: Ga4ReportRequest) => Ga4Report | Promise<Ga4Report>,
): Ga4Client & { calls: { propertyId: string; request: Ga4ReportRequest }[] } {
  const calls: { propertyId: string; request: Ga4ReportRequest }[] = [];
  return {
    calls,
    async runReport(propertyId, request) {
      calls.push({ propertyId, request });
      return answer(propertyId, request);
    },
  };
}

export const row = (dimensions: string[], metrics: (number | string)[]): Ga4Row => ({
  dimensions,
  metrics: metrics.map(String),
});

export const report = (...rows: Ga4Row[]): Ga4Report => ({ rows });

export const hasMetric = (request: Ga4ReportRequest, name: string) =>
  (request.metrics ?? []).some((metric) => metric.name === name);

export const hasDimension = (request: Ga4ReportRequest, name: string) =>
  (request.dimensions ?? []).some((dimension) => dimension.name === name);
