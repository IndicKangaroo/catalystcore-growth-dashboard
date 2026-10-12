import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';
import { useSession } from './session';

function describeSignInError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
      ? err.code
      : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The sign-in window was closed before it finished. Try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.';
    default:
      return 'Sign-in failed. Try again.';
  }
}

export default function LoginPage() {
  const { state, signIn } = useSession();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'ready') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/'} replace />;
  }

  if (state.status === 'not_configured') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="text-xl font-semibold">Sign-in is not set up yet</h1>
        <p className="text-fg-muted">
          Add your Firebase web settings (<code>VITE_FIREBASE_API_KEY</code> and{' '}
          <code>VITE_FIREBASE_PROJECT_ID</code>) to the <code>.env</code> file, then restart the dev
          server. The README explains how.
        </p>
      </main>
    );
  }

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signIn();
    } catch (err) {
      setError(describeSignInError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Growth Analytics</h1>
        <p className="mt-1 text-fg-muted">Sign in with your Google account to continue.</p>
      </div>
      <div>
        <Button onClick={() => void handleSignIn()} disabled={busy}>
          {busy ? 'Opening Google…' : 'Sign in with Google'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <p className="text-sm text-fg-muted">
        Access is by invitation. Ask an admin if you cannot get in.
      </p>
    </main>
  );
}
