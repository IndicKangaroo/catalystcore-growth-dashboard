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

async function toApiError(response: Response): Promise<ApiError> {
  let parsed: { code: string; message: string } | null = null;
  try {
    parsed = readErrorBody(await response.json());
  } catch {
    // The body was not JSON; the generic message below is used instead.
  }
  return new ApiError(
    response.status,
    parsed?.code ?? 'http_error',
    parsed?.message ?? `Request failed with status ${response.status}`,
  );
}

/** Calls the API with the signed-in person's Firebase ID token. Throws ApiError on failure. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  const token = await getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}
