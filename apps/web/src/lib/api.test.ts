import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api';
import { getIdToken } from './firebase';

vi.mock('./firebase', () => ({ getIdToken: vi.fn() }));

/** The parts of a fetch Response that apiFetch uses. A missing body behaves like invalid JSON. */
function fakeResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined
        ? Promise.reject(new SyntaxError('Unexpected end of JSON input'))
        : Promise.resolve(body),
  };
}

async function failureOf(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail');
}

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  function lastRequest(): { path: string; init: RequestInit } {
    const call = fetchMock.mock.calls.at(-1) as [string, RequestInit] | undefined;
    if (!call) throw new Error('fetch was not called');
    return { path: call[0], init: call[1] };
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(getIdToken).mockResolvedValue('token-123');
  });

  it('sends the ID token as a bearer token and returns the JSON body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { hello: 'world' }));

    const result = await apiFetch<{ hello: string }>('/api/me');

    expect(result).toEqual({ hello: 'world' });
    const { path, init } = lastRequest();
    expect(path).toBe('/api/me');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-123' });
    expect(init.body).toBeUndefined();
  });

  it('sends no Authorization header when nobody is signed in', async () => {
    vi.mocked(getIdToken).mockResolvedValue(null);
    fetchMock.mockResolvedValue(fakeResponse(200, {}));

    await apiFetch('/api/me');

    expect(lastRequest().init.headers).not.toHaveProperty('Authorization');
  });

  it('sends a JSON body with the right content type', async () => {
    fetchMock.mockResolvedValue(fakeResponse(201, { ok: true }));

    await apiFetch('/api/users', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'growth' },
    });

    const { init } = lastRequest();
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ email: 'new@example.com', role: 'growth' }));
  });

  it('turns an error response into an ApiError with the server code and message', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(403, {
        error: { code: 'not_invited', message: 'This account has not been invited.' },
      }),
    );

    const error = await failureOf(apiFetch('/api/me'));

    expect(error.status).toBe(403);
    expect(error.code).toBe('not_invited');
    expect(error.message).toBe('This account has not been invited.');
  });

  it('falls back to a generic error when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(fakeResponse(502));

    const error = await failureOf(apiFetch('/api/me'));

    expect(error.status).toBe(502);
    expect(error.code).toBe('http_error');
    expect(error.message).toBe('Request failed with status 502');
  });

  it('falls back to a generic error when the body has an unexpected shape', async () => {
    fetchMock.mockResolvedValue(fakeResponse(500, { oops: true }));

    const error = await failureOf(apiFetch('/api/me'));

    expect(error.status).toBe(500);
    expect(error.code).toBe('http_error');
  });

  it('lets network failures through unchanged', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiFetch('/api/me')).rejects.toThrow('Failed to fetch');
  });
});
