import { useEffect, useState } from 'react';

type Health =
  { state: 'loading' } | { state: 'ok'; provider: string } | { state: 'error'; message: string };

/**
 * Phase P0 placeholder: proves the web app can reach the API.
 * It is replaced by the real shell (router, layout, filters) in phase P2.
 */
export default function App() {
  const [health, setHealth] = useState<Health>({ state: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<{ provider: string }>;
      })
      .then((body) => setHealth({ state: 'ok', provider: body.provider }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setHealth({
          state: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Growth Analytics</h1>
      <p className="mt-1 text-fg-muted">Setting up. Dashboard screens arrive in later phases.</p>

      <section
        aria-live="polite"
        className="mt-6 rounded-lg border border-line bg-muted p-4 text-sm"
      >
        {health.state === 'loading' && <p>Checking API connection…</p>}
        {health.state === 'ok' && (
          <p className="text-ok">API connected (data source: {health.provider})</p>
        )}
        {health.state === 'error' && (
          <p className="text-danger">API not reachable: {health.message}</p>
        )}
      </section>
    </main>
  );
}
