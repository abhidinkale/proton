import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authService } from '../services/auth';

/**
 * Staff QR landing.
 *
 * The desk QR points here with a single-use ticket in the fragment. The fragment
 * never reaches a server log. Exchange it for a normal session, then show Today.
 */
export default function QrLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const ticket = params.get('t') || '';

    // The ticket is spent on first use. Drop it from the address bar before the
    // exchange so a screenshot or a shared link cannot replay it.
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    let alive = true;
    authService
      .loginWithQrTicket(ticket)
      .then(() => {
        if (alive) navigate('/', { replace: true });
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'That sign-in link did not work.');
      });

    return () => {
      alive = false;
    };
  }, [navigate]);

  if (!error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-studio-void">
        <p className="font-mono text-[11px] tracking-[0.24em] text-white/40 uppercase">signing in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-studio-void px-6 text-center">
      <p className="font-mono text-[11px] tracking-[0.24em] text-white/40 uppercase">sign-in failed</p>
      <p className="max-w-sm text-sm leading-relaxed text-white/60">{error}</p>
      <button
        onClick={() => navigate('/login', { replace: true })}
        className="mt-2 font-mono text-[10px] tracking-[0.18em] text-studio-ember uppercase"
      >
        sign in with a password
      </button>
    </div>
  );
}
