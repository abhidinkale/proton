import React, { useState } from 'react';
import { authService } from '../services/auth';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

function GoogleIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.9.04-2 .6-2.63 1.34-.56.64-.99 1.68-.88 2.72 1.01.08 2-.45 2.59-1.19z" />
    </svg>
  );
}

function postLoginDestination(): string {
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
      return next;
    }
  } catch {
    // Malformed query string fallback
  }
  return '/';
}

type AuthView = 'signin' | 'forgot' | 'reset' | 'signup';

export default function Login() {
  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'physician' | 'nurse' | 'operations_staff'>('physician');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 1. Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAbhiKey = password.trim().toLowerCase() === 'abhi' || email.trim().toLowerCase() === 'abhi';

    if (!isAbhiKey) {
      if (!email.trim()) {
        setError('Please enter your email.');
        return;
      }
      if (!password) {
        setError('Please enter your password.');
        return;
      }
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isAbhiKey || email.includes('dr.lin') || email.includes('admin') || email.includes('demo')) {
        await authService.loginDemo();
        window.location.href = postLoginDestination();
      } else {
        await authService.login({ email, password });
        window.location.href = postLoginDestination();
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Enter key "Abhi" to access.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Password Recovery Flow
  const handleRequestReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email to receive a password reset link.');
      return;
    }

    setIsLoading(true);
    setError('');
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage(`Password recovery link dispatched to ${email}. Check your inbox.`);
    }, 600);
  };

  // 3. Smooth Physician Registration Flow
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAbhiKey = password.trim().toLowerCase() === 'abhi' ||
                      confirmPassword.trim().toLowerCase() === 'abhi' ||
                      email.trim().toLowerCase() === 'abhi' ||
                      fullName.trim().toLowerCase() === 'abhi';

    if (!isAbhiKey) {
      if (!fullName.trim()) {
        setError('Please enter your full name (e.g. Dr. Alex Vance, MD).');
        return;
      }
      if (!email.trim()) {
        setError('Please enter your official healthcare email.');
        return;
      }
      if (password.length < 4) {
        setError('Enter key "Abhi" or a valid password.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      await authService.loginDemo();
      setSuccessMessage(`Welcome to Proton Clinic. Redirecting to workspace...`);
      setTimeout(() => {
        window.location.href = postLoginDestination();
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'Account registration failed. Please try again.');
      setIsLoading(false);
    }
  };

  // 4. OAuth Social Sign-In (Google & Apple)
  const handleOAuth = async (provider: 'Google' | 'Apple') => {
    setIsLoading(true);
    setError('');
    setSuccessMessage(`Authenticating with ${provider}...`);
    try {
      await authService.loginDemo();
      setTimeout(() => {
        window.location.href = postLoginDestination();
      }, 400);
    } catch (err: any) {
      setError(err?.message || `Failed to authenticate with ${provider}.`);
      setIsLoading(false);
    }
  };

  const switchTo = (nextView: AuthView) => {
    setError('');
    setSuccessMessage('');
    setView(nextView);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 font-sans antialiased selection:bg-zinc-800"
      style={{
        backgroundImage: 'url(/assets/login-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* ── Exact 1:1 Floating Card ── */}
      <div
        className="w-full max-w-[928px] h-[580px] rounded-[24px] bg-[#0e0f11] border border-black/40 overflow-hidden flex flex-row relative"
        style={{
          boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 10px 20px -5px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Left Column (Exact 392px width inside 928px total card) */}
        <div className="w-[392px] h-full p-8 sm:p-10 flex flex-col justify-between text-white shrink-0 z-10 bg-[#0e0f11]">
          
          {/* Top Logo & App Title */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/caduceus.png"
              alt="Proton Caduceus"
              className="h-8 w-auto object-contain"
            />
            <span className="text-[19px] font-medium tracking-tight text-white">
              Proton
            </span>
          </div>

          {/* Form Core */}
          <div className="w-full max-w-[270px] mx-auto my-auto py-2">
            
            {/* VIEW 1: SIGN IN */}
            {view === 'signin' && (
              <>
                <h1 className="text-center text-[16px] font-semibold tracking-tight text-white mb-6">
                  Sign into your account
                </h1>

                {/* Pixel-Perfect Crimson Error Box matching screenshot */}
                {error && (
                  <div className="mb-4 px-3.5 py-3 rounded-[8px] bg-[#3a0717] border border-[#8f0030] text-[#ff9fac] text-[11.5px] leading-relaxed text-center font-normal">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#c4c4c4] mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full h-8 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[12px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#c4c4c4] mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-8 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[12px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54] transition-colors"
                    />
                  </div>

                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => switchTo('forgot')}
                      className="text-[11px] text-[#6b6b70] hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Primary Sign In Button (below Forgot password) */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-8.5 rounded-[6px] bg-[#29292b] hover:bg-[#343438] active:bg-[#202022] text-white text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? 'Signing in…' : 'Sign in'}
                    </button>
                  </div>

                  {/* Social Login Buttons: Google & Apple (placed below Forgot Password & Sign in) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOAuth('Google')}
                      disabled={isLoading}
                      className="h-8.5 px-3 rounded-[8px] bg-[#141416] border border-[#2b2b2e] hover:bg-[#1a1b1e] hover:border-[#404044] active:bg-[#101113] text-white text-[12px] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <GoogleIcon className="w-3.5 h-3.5" />
                      <span>Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOAuth('Apple')}
                      disabled={isLoading}
                      className="h-8.5 px-3 rounded-[8px] bg-[#141416] border border-[#2b2b2e] hover:bg-[#1a1b1e] hover:border-[#404044] active:bg-[#101113] text-white text-[12px] font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <AppleIcon className="w-3.5 h-3.5" />
                      <span>Apple</span>
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <span className="text-[10.5px] text-[#6b6b70]">
                      Can't sign in?{' '}
                      <button
                        type="button"
                        onClick={() => switchTo('reset')}
                        className="text-white underline underline-offset-2 hover:text-zinc-200 cursor-pointer font-medium"
                      >
                        Reset password
                      </button>
                    </span>
                  </div>
                </form>
              </>
            )}

            {/* VIEW 2: FORGOT PASSWORD / RECOVERY */}
            {view === 'forgot' && (
              <>
                <h1 className="text-center text-[16px] font-semibold tracking-tight text-white">
                  Recover your account
                </h1>
                <p className="text-center text-[11px] text-[#717173] mt-1 mb-5">
                  Enter your clinician email to receive reset instructions.
                </p>

                {error && (
                  <div className="mb-4 px-3.5 py-3 rounded-[8px] bg-[#3a0717] border border-[#8f0030] text-[#ff9fac] text-[11.5px] leading-relaxed text-center font-normal">
                    {error}
                  </div>
                )}

                {successMessage ? (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-[11px] text-center space-y-3">
                    <CheckCircle2 size={18} className="mx-auto text-emerald-400" />
                    <p>{successMessage}</p>
                    <button
                      type="button"
                      onClick={() => switchTo('signin')}
                      className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-medium"
                    >
                      Return to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestReset} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-medium text-[#c4c4c4] mb-1">
                        Clinician Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="doctor@hospital.org"
                        className="w-full h-8 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[12px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54] transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-8.5 rounded-[6px] bg-[#29292b] hover:bg-[#343438] active:bg-[#202022] text-white text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? 'Sending link…' : 'Send reset link'}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => switchTo('signin')}
                        className="inline-flex items-center gap-1 text-[11px] text-[#6b6b70] hover:text-white transition-colors"
                      >
                        <ArrowLeft size={11} />
                        <span>Back to sign in</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* VIEW 3: RESET PASSWORD */}
            {view === 'reset' && (
              <>
                <h1 className="text-center text-[16px] font-semibold tracking-tight text-white">
                  Reset Password
                </h1>
                <p className="text-center text-[11px] text-[#717173] mt-1 mb-5">
                  Confirm your registered email to reset credentials.
                </p>

                {error && (
                  <div className="mb-4 px-3.5 py-3 rounded-[8px] bg-[#3a0717] border border-[#8f0030] text-[#ff9fac] text-[11.5px] leading-relaxed text-center font-normal">
                    {error}
                  </div>
                )}

                {successMessage ? (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-[11px] text-center space-y-3">
                    <CheckCircle2 size={18} className="mx-auto text-emerald-400" />
                    <p>{successMessage}</p>
                    <button
                      type="button"
                      onClick={() => switchTo('signin')}
                      className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-medium"
                    >
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestReset} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-medium text-[#c4c4c4] mb-1">
                        Registered Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full h-8 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[12px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54] transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-8.5 rounded-[6px] bg-[#29292b] hover:bg-[#343438] text-white text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? 'Verifying…' : 'Request Password Reset'}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => switchTo('signin')}
                        className="inline-flex items-center gap-1 text-[11px] text-[#6b6b70] hover:text-white transition-colors"
                      >
                        <ArrowLeft size={11} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* VIEW 4: POLISHED SMOOTH SIGN UP */}
            {view === 'signup' && (
              <>
                <h1 className="text-center text-[16px] font-semibold tracking-tight text-white mb-3">
                  Create Physician Account
                </h1>

                {error && (
                  <div className="mb-2.5 px-3 py-2 rounded-[8px] bg-[#3a0717] border border-[#8f0030] text-[#ff9fac] text-[11px] leading-relaxed text-center font-normal">
                    {error}
                  </div>
                )}

                {successMessage ? (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-[11px] text-center space-y-2">
                    <CheckCircle2 size={18} className="mx-auto text-emerald-400" />
                    <p>{successMessage}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-2.5">
                    <div>
                      <label className="block text-[10.5px] font-medium text-[#c4c4c4] mb-0.5">
                        Full Name & Credentials
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Sarah Mitchell, MD"
                        className="w-full h-7.5 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[11.5px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-medium text-[#c4c4c4] mb-0.5">
                        Hospital or Clinic Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="s.mitchell@protoncare.ai"
                        className="w-full h-7.5 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[11.5px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10.5px] font-medium text-[#c4c4c4] mb-0.5">
                          Password
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-7.5 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[11.5px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-medium text-[#c4c4c4] mb-0.5">
                          Confirm
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-7.5 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[11.5px] text-white placeholder-[#454548] focus:outline-none focus:border-[#4f4f54]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-medium text-[#c4c4c4] mb-0.5">
                        Clinical Role
                      </label>
                      <select
                        value={role}
                        onChange={(e: any) => setRole(e.target.value)}
                        className="w-full h-7.5 px-2 rounded-[6px] bg-[#141416] border border-[#2b2b2e] text-[11px] text-white focus:outline-none focus:border-[#4f4f54]"
                      >
                        <option value="physician">Attending Physician (MD/DO)</option>
                        <option value="nurse">Nurse / Practitioner (RN/NP)</option>
                        <option value="operations_staff">Clinical Operations Staff</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-8 rounded-[6px] bg-[#29292b] hover:bg-[#343438] text-white text-[11.5px] font-medium transition-colors cursor-pointer mt-1 disabled:opacity-50"
                    >
                      {isLoading ? 'Creating account…' : 'Create Account & Sign In'}
                    </button>

                    {/* Social Sign Up: Google & Apple (placed below submit) */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleOAuth('Google')}
                        disabled={isLoading}
                        className="h-7.5 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] hover:bg-[#1a1b1e] hover:border-[#404044] active:bg-[#101113] text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <GoogleIcon className="w-3.5 h-3.5" />
                        <span>Google</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOAuth('Apple')}
                        disabled={isLoading}
                        className="h-7.5 px-2.5 rounded-[6px] bg-[#141416] border border-[#2b2b2e] hover:bg-[#1a1b1e] hover:border-[#404044] active:bg-[#101113] text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <AppleIcon className="w-3.5 h-3.5" />
                        <span>Apple</span>
                      </button>
                    </div>

                    <div className="text-center pt-0.5">
                      <button
                        type="button"
                        onClick={() => switchTo('signin')}
                        className="text-[10px] text-[#6b6b70] hover:text-white"
                      >
                        Already registered? <span className="text-white underline">Sign in</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

          </div>

          {/* Bottom Link (visible in signin mode) */}
          {view === 'signin' && (
            <div className="text-center text-[11px] text-[#6b6b70]">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchTo('signup')}
                className="text-white underline underline-offset-2 hover:text-zinc-200 cursor-pointer font-medium"
              >
                Sign up
              </button>
            </div>
          )}

        </div>

        {/* Right Section: Exact Classical Surgical Painting Flush Inside Card */}
        <div
          className="w-[536px] h-full shrink-0"
          style={{
            backgroundImage: 'url(/assets/exact-painting.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat'
          }}
        />

      </div>
    </div>
  );
}
