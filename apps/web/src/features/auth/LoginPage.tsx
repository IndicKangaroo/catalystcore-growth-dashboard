import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CenteredCard } from '../../components/CenteredCard';
import { LogoTile } from '../../components/LogoTile';
import { Notice } from '../../components/Notice';
import { PRODUCT_NAME } from '../../lib/product';
import { useSession } from './session';

/**
 * Turns a Firebase sign-in failure into words. Most of the unusual ones mean the Firebase project
 * is not set up yet, so those say what to change; the person who sees them can pass them on to
 * whoever set the dashboard up. An unknown failure shows its code so it can be looked up.
 */
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
      return 'Network problem. Check your connection and try again. If you use the Firebase emulators, check that "npm run emulators" is running.';
    case 'auth/web-storage-unsupported':
      return 'Your browser is blocking the storage that sign-in needs. Allow cookies and site data for this site, then try again.';
    case 'auth/user-disabled':
      return 'This Google account has been disabled in Firebase. Ask an admin.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/unauthorized-domain':
      return 'Sign-in setup problem: this web address is not allowed to sign in. In the Firebase console open Authentication, Settings, Authorized domains and add it. For local development, open the app at http://localhost:5173 (not 127.0.0.1).';
    case 'auth/operation-not-allowed':
      return 'Sign-in setup problem: Google sign-in is not turned on for this Firebase project. In the Firebase console open Authentication, Sign-in method and enable Google.';
    case 'auth/configuration-not-found':
      return 'Sign-in setup problem: Firebase Authentication has not been set up for this project. In the Firebase console open Authentication, press Get started, then enable Google.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'Sign-in setup problem: Firebase rejected the web API key. Copy VITE_FIREBASE_API_KEY again from the Firebase console (Project settings), save .env and restart the dev server.';
    default:
      return code ? `Sign-in failed (${code}). Try again.` : 'Sign-in failed. Try again.';
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
      <CenteredCard title="Sign-in is not set up yet">
        <p className="text-fg-muted">
          Add your Firebase web settings (
          <code className="font-mono text-[13px]">VITE_FIREBASE_API_KEY</code> and{' '}
          <code className="font-mono text-[13px]">VITE_FIREBASE_PROJECT_ID</code>) to the{' '}
          <code className="font-mono text-[13px]">.env</code> file, then restart the dev server. The
          README explains how.
        </p>
      </CenteredCard>
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
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-3">
          <LogoTile name={PRODUCT_NAME} />
          <h1 className="text-xl font-semibold tracking-tight text-fg">{PRODUCT_NAME}</h1>
        </div>
        <p className="mt-4 text-sm text-fg-muted">Sign in with your Google account to continue.</p>
        <div className="mt-5">
          <Button onClick={() => void handleSignIn()} disabled={busy}>
            {busy ? 'Opening Google…' : 'Sign in with Google'}
          </Button>
        </div>
        {error && (
          <Notice tone="danger" className="mt-4">
            {error}
          </Notice>
        )}
        <p className="mt-5 text-xs text-fg-subtle">
          Access is by invitation. Ask an admin if you cannot get in.
        </p>
      </Card>
    </main>
  );
}
