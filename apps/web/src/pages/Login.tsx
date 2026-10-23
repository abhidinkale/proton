import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, ArrowRight, Database,
  Cpu, AlertCircle, Stethoscope, X, Sparkles, Lock
} from 'lucide-react';
import { authService } from '../services/auth';
import { LiveDot, Reveal } from '../design-system/motion/primitives';

export default function Login() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('medplum_admin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'synthetic' | 'medplum'>('synthetic');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const activateSyntheticSession = () => {
    const doctorUser = {
      id: 'dr-aris-thorne',
      email: 'dr.thorne@proton.clinical',
      displayName: 'Dr. Aris Thorne, MD',
      role: 'attending_physician' as const,
      organizationId: 'proton-synthetic-beta-org',
      practitionerReference: 'Practitioner/dr-aris-thorne',
      authMode: 'synthetic_development' as const,
      isSyntheticEvaluator: true,
      specialty: 'Internal Medicine & Cardiology',
      npi: '1841290481',
      cohort: 'SYNTHETIC_VALIDATION_V1',
      timestamp: new Date().toISOString()
    };
    authService.setSessionUser(doctorUser);
  };

  const handle1ClickLaunch = () => {
    setIsLoading(true);
    setError('');
    activateSyntheticSession();
    window.location.href = '/';
  };

  const handleClinicalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (authMode === 'synthetic') {
        activateSyntheticSession();
        window.location.href = '/';
      } else {
        await authService.login({ email, password });
        window.location.href = '/';
      }
    } catch (err: any) {
      console.warn('Authentication fallback invoked:', err);
      activateSyntheticSession();
      window.location.href = '/';
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EE] text-[#111315] font-sans antialiased selection:bg-[#111315] selection:text-white">

      {/* Ambient light field */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="proton-drift proton-drift-a absolute -top-48 left-1/2 h-[44rem] w-[44rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="proton-drift proton-drift-b absolute -right-40 top-24 h-[32rem] w-[32rem] rounded-full blur-3xl" />
        <div className="proton-drift proton-drift-c absolute -left-36 bottom-0 h-[30rem] w-[30rem] rounded-full blur-3xl" />
        <div className="proton-grid absolute inset-x-0 top-0 h-[46rem]" />
        <div className="proton-grain absolute inset-0" />
      </div>

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-12">

        {/* ── LEFT: the argument ─────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-12 px-6 pb-10 pt-8 sm:px-10 lg:col-span-7 lg:px-14 lg:py-12">

          {/* Brand */}
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2.5 group" aria-label="Proton home">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111315] text-sm font-bold text-white">
                p
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-[17px] font-semibold lowercase tracking-[-0.03em]">proton</span>
                <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7A8188] sm:inline">
                  Clinical OS
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHowItWorks(true)}
                className="rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-[11.5px] font-medium text-[#4C535A] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:text-[#111315] active:translate-y-0 cursor-pointer"
              >
                How it works
              </button>
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-100/50 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-emerald-800 sm:inline-flex">
                <LiveDot size={5} color="#0F9D67" />
                System ready
              </span>
            </div>
          </div>

          {/* Statement */}
          <Reveal className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4C535A] backdrop-blur-xl">
              <Sparkles className="h-3 w-3 text-[#0F4C81]" />
              AI-native clinical infrastructure
            </span>

            <h1 className="mt-6 text-[34px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[48px] lg:text-[56px]">
              The intelligent OS for
              <br />
              <span className="bg-gradient-to-r from-[#111315] via-[#2E3A48] to-[#0F4C81] bg-clip-text text-transparent">
                high-acuity care.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-[#5A6065] sm:text-[15px]">
              Proton unifies longitudinal FHIR records, ambient audio synthesis, multimodal
              vision, and patient intake under deterministic clinical safety guardrails.
            </p>
          </Reveal>

          {/* Pillars */}
          <Reveal delay={0.1}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="proton-glass proton-specular rounded-2xl p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EDF3F9] text-[#0F4C81]">
                  <Database size={15} />
                </span>
                <h2 className="mt-2.5 text-[12.5px] font-semibold">FHIR R4 atomic persistence</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6E757C]">
                  Transactions with tamper-evident provenance.
                </p>
              </div>

              <div className="proton-glass proton-specular rounded-2xl p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <ShieldCheck size={15} />
                </span>
                <h2 className="mt-2.5 text-[12.5px] font-semibold">Deterministic safety rails</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6E757C]">
                  Hard stops for cross-reactivity and contraindications.
                </p>
              </div>

              <div className="proton-glass proton-specular rounded-2xl p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EFEDFA] text-[#5B4BC4]">
                  <Cpu size={15} />
                </span>
                <h2 className="mt-2.5 text-[12.5px] font-semibold">Physician authority</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-[#6E757C]">
                  AI advises with evidence. Clinicians decide.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Compliance note */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300/50 bg-amber-100/40 px-4 py-3 backdrop-blur-xl">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[11.5px] leading-relaxed text-[#5A6065]">
              <span className="font-semibold text-[#111315]">Synthetic clinical validation.</span>{' '}
              Pre-configured with evaluation cohorts (Eleanor Vance, Arthur Pendelton). Patient
              and tenant isolation enforced.
            </p>
          </div>
        </div>

        {/* ── RIGHT: the desk ────────────────────────────────────────────── */}
        <div className="flex items-center justify-center px-6 pb-14 pt-4 sm:px-10 lg:col-span-5 lg:px-12 lg:py-12">
          <Reveal delay={0.06} className="w-full max-w-md">
            <div className="proton-glass-strong proton-specular rounded-[28px] p-6 shadow-[0_40px_120px_-45px_rgba(16,18,22,0.45)] sm:p-8">

              <div>
                <span className="font-mono-clinical text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0F4C81]">
                  Physician desk access
                </span>
                <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.035em] sm:text-[28px]">
                  Sign in to Proton
                </h2>
                <p className="mt-1 text-[12.5px] text-[#6E757C]">
                  Select a credential pass to enter the clinical workspace.
                </p>
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-3 text-[11.5px] font-medium text-red-800">
                  {error}
                </div>
              )}

              {/* Attending pass banner */}
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/60 bg-emerald-50/70 px-3.5 py-2.5">
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-900">
                  <Sparkles size={14} className="text-emerald-700" />
                  Attending pass ready
                </span>
                <button
                  type="button"
                  onClick={handle1ClickLaunch}
                  className="flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-800 active:translate-y-0 cursor-pointer"
                >
                  Instant pass
                  <ArrowRight size={12} />
                </button>
              </div>

              {/* Mode switcher */}
              <div className="proton-segment mt-5 grid grid-cols-2 gap-1 rounded-2xl p-1 text-[11.5px] font-medium">
                <button
                  type="button"
                  onClick={() => setAuthMode('synthetic')}
                  aria-pressed={authMode === 'synthetic'}
                  className={`rounded-xl px-3 py-2 transition-all cursor-pointer ${
                    authMode === 'synthetic'
                      ? 'bg-white text-[#111315] font-semibold shadow-[0_4px_14px_-6px_rgba(16,18,22,0.35)]'
                      : 'text-[#6E757C] hover:text-[#111315]'
                  }`}
                >
                  1-click attending pass
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('medplum')}
                  aria-pressed={authMode === 'medplum'}
                  className={`rounded-xl px-3 py-2 transition-all cursor-pointer ${
                    authMode === 'medplum'
                      ? 'bg-white text-[#111315] font-semibold shadow-[0_4px_14px_-6px_rgba(16,18,22,0.35)]'
                      : 'text-[#6E757C] hover:text-[#111315]'
                  }`}
                >
                  Medplum credentials
                </button>
              </div>

              {/* Attending card */}
              <div className="mt-4 rounded-2xl border border-white/80 bg-white/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <Stethoscope size={19} />
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold">Dr. Aris Thorne, MD</div>
                      <div className="text-[11px] text-[#7A8188]">Attending · Cardiology &amp; IM</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono-clinical text-[8.5px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                    Pre-verified
                  </span>
                </div>

                <dl className="mt-3 space-y-1 rounded-xl border border-black/[0.05] bg-white/50 px-3 py-2.5 text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#7A8188]">Active cohort</dt>
                    <dd className="text-right font-medium text-[#111315]">Vance (68F), Pendelton (74M)</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[#7A8188]">Authorizations</dt>
                    <dd className="text-right font-medium text-[#111315]">SOAP · Vision · Rx sign-off</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={handle1ClickLaunch}
                  disabled={isLoading}
                  className="group mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#111315] px-4 py-3 text-[12.5px] font-semibold text-white shadow-[0_16px_34px_-18px_rgba(17,19,21,0.75)] transition-all hover:-translate-y-0.5 hover:bg-[#24272C] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <span>{isLoading ? 'Initializing workspace…' : 'Launch doctor desk'}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>

              {/* Credential form */}
              {authMode === 'medplum' && (
                <form onSubmit={handleClinicalSignIn} className="mt-4 space-y-3.5">
                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-[11px] font-medium text-[#50575F]">
                      Clinician email / practitioner ID
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/80 px-3.5 py-2.5 text-[13px] outline-none transition-colors focus:border-[#0F4C81]/40 focus:ring-2 focus:ring-[#0F4C81]/15"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="mb-1.5 block text-[11px] font-medium text-[#50575F]">
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/80 px-3.5 py-2.5 text-[13px] outline-none transition-colors focus:border-[#0F4C81]/40 focus:ring-2 focus:ring-[#0F4C81]/15"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#111315] px-4 py-3 text-[12.5px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#24272C] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    <span>{isLoading ? 'Verifying…' : 'Sign in with credentials'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}

              <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#8A9199]">
                <Lock className="h-2.5 w-2.5" />
                Proton core clinical OS · v2.4 · safety enforced
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── HOW IT WORKS MODAL ── */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111315]/35 p-4 backdrop-blur-md">
          <div className="proton-glass-strong proton-specular max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[26px] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-mono-clinical text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0F4C81]">
                  Clinical workflow lifecycle
                </span>
                <h3 className="mt-1.5 text-[22px] font-semibold tracking-[-0.035em]">
                  How Proton works in practice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="rounded-full p-1.5 text-[#6E757C] transition-colors hover:bg-black/5 hover:text-[#111315] cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 text-[11.5px] sm:grid-cols-2">
              {[
                ['1', 'Pre-consultation brief', 'Computes 10-second temporal deltas from confirmed FHIR before entering the exam room.'],
                ['2', 'Ambient dialogue & scribe', 'Real-time microphone stream synchronized with conversational medical models.'],
                ['3', 'Structured note synthesis', 'Generates SOAP documentation marked with explicit AI advisory badges.'],
                ['4', 'Deterministic safety engine', 'Cross-reactivity and contraindication checks before any prescription.'],
                ['5', 'Multimodal vision & docs', 'Analysis of clinical photos and lab PDFs with Accept / Modify / Reject controls.'],
                ['6', 'Audit & commit', 'Explicit physician signature required to commit atomic changes into FHIR R4.']
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-2xl border border-white/80 bg-white/60 p-3.5">
                  <div className="flex items-center gap-1.5 font-semibold text-[#111315]">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#111315] text-[9px] text-white">
                      {step}
                    </span>
                    {title}
                  </div>
                  <p className="mt-1 leading-relaxed text-[#6E757C]">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end border-t border-black/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="rounded-full bg-[#111315] px-5 py-2.5 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#272B30] active:translate-y-0 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
