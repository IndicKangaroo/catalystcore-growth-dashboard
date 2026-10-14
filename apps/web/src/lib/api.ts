import { getIdToken } from './firebase';

/** An error response from the API, in the standard { error: { code, message } } shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

function readErrorBody(body: unknown): { code: string; message: string } | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null;
  const error = body.error;
  if (typeof error !== 'object' || error === null) return null;
  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;
  return typeof code === 'string' && typeof message === 'string' ? { code, message } : null;
}

const UNREACHABLE_MESSAGE =
  'Could not reach the API. If you run it locally, check that "npm run dev" is running and read its output for the reason, then try again.';

async function toApiError(response: Response): Promise<ApiError> {
  let parsed: { code: string; message: string } | null = null;
  let isJson = true;
  try {
    parsed = readErrorBody(await response.json());
  } catch {
    isJson = false;
  }
  if (parsed) return new ApiError(response.status, parsed.code, parsed.message);

  // A server error that is not JSON did not come from our API: the dev server's proxy answers like
  // this when the API is down, and so does a gateway in front of a deployment that is failing.
  if (!isJson && response.status >= 500) {
    return new ApiError(response.status, 'api_unreachable', UNREACHABLE_MESSAGE);
  }
  return new ApiError(
    response.status,
    'http_error',
    `Request failed with status ${response.status}`,
  );
}

/** Calls the API with the signed-in person's Firebase ID token. Throws ApiError on failure. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  const token = await getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    // fetch rejects with a TypeError when nothing answered at all (offline, server down). An
    // aborted request is the caller's own doing and passes through unchanged.
    if (err instanceof TypeError) throw new ApiError(0, 'network_error', UNREACHABLE_MESSAGE);
    throw err;
  }

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}
