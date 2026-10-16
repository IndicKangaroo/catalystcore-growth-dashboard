import { vi } from 'vitest';

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

export interface ApiReply {
  /** Defaults to 200. */
  status?: number;
  /** Leave out for an answer with no body, such as a 204. */
  body?: unknown;
}

type Route = ApiReply | ((request: RecordedRequest) => ApiReply);

/** An error answer in the API's standard shape. */
export function apiError(status: number, code: string, message: string): ApiReply {
  return { status, body: { error: { code, message } } };
}

function answer({ status = 200, body }: ApiReply) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined
        ? Promise.reject(new SyntaxError('Unexpected end of JSON input'))
        : Promise.resolve(body),
  });
}

/** An exact route wins; otherwise the first key ending in "*" whose start matches the request. */
function findRoute(routes: Record<string, Route>, method: string, path: string): Route | undefined {
  const exact = routes[`${method} ${path}`] ?? (method === 'GET' ? routes[path] : undefined);
  if (exact) return exact;

  for (const [key, route] of Object.entries(routes)) {
    if (!key.endsWith('*')) continue;
    const start = key.slice(0, -1);
    if (`${method} ${path}`.startsWith(start) || (method === 'GET' && path.startsWith(start))) {
      return route;
    }
  }
  return undefined;
}

/**
 * Replaces fetch with a fake API, so a screen can be exercised through the real apiFetch. Routes are
 * keyed "METHOD /path", or just "/path" for a GET; a key that ends in "*" matches every path that
 * starts the same way ("PATCH /api/apps/*"). A function route builds its answer from the request,
 * which is how a test keeps state (a list that grows after a POST). A request nobody planned for
 * answers 404, so a test notices a call it did not expect. Returns the requests seen, in order.
 */
export function stubApi(routes: Record<string, Route>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const request = { method, path, body };
      requests.push(request);

      const route = findRoute(routes, method, path);
      if (!route) return answer(apiError(404, 'not_found', `No fake route for ${method} ${path}`));
      return answer(typeof route === 'function' ? route(request) : route);
    }),
  );

  return requests;
}
