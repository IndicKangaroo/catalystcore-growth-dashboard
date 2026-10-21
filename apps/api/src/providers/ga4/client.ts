import type { Ga4Client, Ga4Report, Ga4ReportRequest } from './types';

/** A GA4 failure that has been put into words a person can act on. */
export class Ga4Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Ga4Error';
  }
}

// gRPC status codes the Data API answers with.
const INVALID_ARGUMENT = 3;
const NOT_FOUND = 5;
const PERMISSION_DENIED = 7;
const RESOURCE_EXHAUSTED = 8;
const UNAUTHENTICATED = 16;

const codeOf = (err: unknown): number | undefined =>
  typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'number'
    ? (err as { code: number }).code
    : undefined;

/** Says what went wrong with a GA4 call and what to do about it. Never includes key material. */
export function describeGa4Error(err: unknown, propertyId: string): Ga4Error {
  switch (codeOf(err)) {
    case PERMISSION_DENIED:
      return new Ga4Error(
        `GA4 refused access to property ${propertyId}. Add the service account's email as a ` +
          'Viewer on that property (GA4 Admin, Property access management), and check that the ' +
          "Google Analytics Data API is enabled for the key's project.",
      );
    case NOT_FOUND:
      return new Ga4Error(`GA4 property ${propertyId} was not found. Check the property ID.`);
    case UNAUTHENTICATED:
      return new Ga4Error(
        'GA4 did not accept the service account key. Check GA4_SERVICE_ACCOUNT_KEY_FILE ' +
          '(or GOOGLE_APPLICATION_CREDENTIALS) points at a valid service account key file.',
      );
    case RESOURCE_EXHAUSTED:
      return new Ga4Error('GA4 says the request quota is used up for now. Try again later.');
    case INVALID_ARGUMENT:
      return new Ga4Error(
        `GA4 rejected the request for property ${propertyId}: ` +
          (err instanceof Error ? err.message : 'invalid argument'),
      );
    default:
      return new Ga4Error(
        `GA4 could not be read for property ${propertyId}: ` +
          (err instanceof Error ? err.message : String(err)),
      );
  }
}

export interface Ga4ClientOptions {
  /** A service account key file. Without it, Google's default credentials are used. */
  keyFile?: string;
}

/**
 * The real GA4 Data API client (D-004). The package is loaded on first use, so the API starts and
 * the demo provider runs without it ever being touched.
 */
export function createGa4Client(options: Ga4ClientOptions = {}): Ga4Client {
  let loaded: Promise<import('@google-analytics/data').BetaAnalyticsDataClient> | undefined;
  const load = () =>
    (loaded ??= import('@google-analytics/data').then(
      ({ BetaAnalyticsDataClient }) =>
        new BetaAnalyticsDataClient(options.keyFile ? { keyFilename: options.keyFile } : {}),
    ));

  return {
    async runReport(propertyId, request: Ga4ReportRequest): Promise<Ga4Report> {
      try {
        const client = await load();
        const [response] = await client.runReport({
          property: `properties/${propertyId}`,
          ...request,
        } as Parameters<typeof client.runReport>[0]);
        return {
          rows: (response.rows ?? []).map((row) => ({
            dimensions: (row.dimensionValues ?? []).map((cell) => cell.value ?? ''),
            metrics: (row.metricValues ?? []).map((cell) => cell.value ?? ''),
          })),
        };
      } catch (err) {
        throw describeGa4Error(err, propertyId);
      }
    },
  };
}
