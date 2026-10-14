import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { authService } from '../services/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login({ email, password });
      navigate('/');
    } catch (loginError) {
      console.error(loginError);
      const message = loginError instanceof Error
        ? loginError.message
        : 'Authentication failed. Please verify your credentials or connection.';
      setError(message.includes('Too Many Requests')
        ? 'Too many sign-in attempts. Please wait before trying again.'
        : message);
    } finally {
      setLoading(false);
    }
  };

  const fillEvaluationCredentials = () => {
    setEmail('admin@example.com');
    setPassword(atob('bWVkcGx1bV9hZG1pbg=='));
    setError('');
  };

  return (
    <main className="min-h-screen bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-default)] bg-[var(--color-surface)]">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/welcome" className="text-lg font-semibold tracking-tight" aria-label="Proton home">
            proton
          </Link>
          <Link to="/welcome" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            About Proton
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[1fr_420px] lg:items-start lg:gap-20">
        <section className="max-w-xl">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">Physician workspace</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Sign in to continue your clinical work.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
            Review patient context, prepare consultation notes, and work through documentation in one place.
          </p>

          <div className="mt-8 flex gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]" strokeWidth={1.8} />
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              AI-generated content requires clinician review. This evaluation environment uses synthetic records only.
            </p>
          </div>
        </section>

        <section className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] p-5 sm:p-7">
          <h2 className="text-lg font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Use your workspace credentials.</p>

          {error && (
            <p className="mt-5 rounded-lg border border-[var(--color-clinical-danger)]/30 bg-[var(--color-clinical-danger-bg)] px-3 py-2.5 text-sm text-[var(--color-clinical-danger)]" role="alert">
              {error}
            </p>
          )}

          <form className="mt-6 space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-secondary)]"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-secondary)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-text-primary)] px-4 text-sm font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-65"
            >
              {loading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Signing in
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--color-border-default)] pt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Evaluating Proton?</p>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  await authService.login({
                    email: 'admin@example.com',
                    password: atob('bWVkcGx1bV9hZG1pbg==')
                  });
                  navigate('/');
                } catch (err: any) {
                  setError(err?.message || 'Login failed');
                } finally {
                  setLoading(false);
                }
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span>Instant Physician Demo Access</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={fillEvaluationCredentials}
              className="inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-[var(--color-border-strong)] px-3 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] transition-colors cursor-pointer"
            >
              Fill evaluation credentials into form
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
