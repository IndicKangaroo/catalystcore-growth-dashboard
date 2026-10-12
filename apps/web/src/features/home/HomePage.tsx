import { useEffect, useState } from 'react';
import { useSession } from '../auth/session';

type Health = { state: 'loading' } | { state: 'ok'; provider: string } | { state: 'error' };

/** Placeholder home page: confirms the session and that the API is reachable. */
export default function HomePage() {
  const { state } = useSession();
  const [health, setHealth] = useState<Health>({ state: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<{ provider: string }>;
      })
      .then((body) => setHealth({ state: 'ok', provider: body.provider }))
      .catch(() => {
        if (!controller.signal.aborted) setHealth({ state: 'error' });
      });

    return () => controller.abort();
  }, []);

  const who = state.status === 'ready' ? (state.user.name ?? state.user.email) : '';

  return (
    <section>
      <h1 className="text-2xl font-semibold">{who ? `Welcome, ${who}` : 'Welcome'}</h1>
      <p className="mt-1 text-fg-muted">Dashboard screens arrive in later phases.</p>

      <div
        aria-live="polite"
        className="mt-6 max-w-xl rounded-lg border border-line bg-muted p-4 text-sm"
      >
        {health.state === 'loading' && <p>Checking API connection…</p>}
        {health.state === 'ok' && (
          <p className="text-ok">API connected (data source: {health.provider})</p>
        )}
        {health.state === 'error' && <p className="text-danger">API not reachable</p>}
      </div>
    </section>
  );
}
