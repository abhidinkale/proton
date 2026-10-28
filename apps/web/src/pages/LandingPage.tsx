import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Lock,
  Mic,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import {
  CountUp,
  LiveDot,
  PROTON_EASE,
  Reveal,
  Stagger,
  StaggerItem
} from '../design-system/motion/primitives';

function Sparkline({ points, className = '' }: { points: number[]; className?: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;

  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 40 - ((point - min) / span) * 32;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 44"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={coordinates}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'brief' | 'safety' | 'memory'>('brief');
  const [provenanceBadge, setProvenanceBadge] = useState<'draft' | 'edited'>('draft');
  const [isCommitted, setIsCommitted] = useState(false);

  const tabMotion = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.22, ease: PROTON_EASE }
  };

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-paper-2 text-ink font-sans antialiased selection:bg-solid selection:text-white">
      {/* Ambient light fields */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="proton-drift proton-drift-a absolute -top-40 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="proton-drift proton-drift-b absolute -right-40 top-40 h-[34rem] w-[34rem] rounded-full blur-3xl" />
        <div className="proton-drift proton-drift-c absolute -left-32 top-[38rem] h-[30rem] w-[30rem] rounded-full blur-3xl" />
        <div className="proton-grid absolute inset-x-0 top-0 h-[52rem]" />
        <div className="proton-grain absolute inset-0" />
      </div>

      {/* Floating frosted navigation */}
      <header className="sticky top-0 z-50 px-4 pt-3 sm:pt-4">
        <div className="proton-glass proton-specular mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 rounded-full pr-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Proton home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-solid text-sm font-bold text-white">
              p
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-[-0.03em] lowercase">proton</span>
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-2 sm:inline">
                Clinical OS
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-0.5 rounded-full bg-black/[0.035] p-1 md:flex" aria-label="Sections">
            {[
              { id: 'platform', label: 'Platform' },
              { id: 'safety', label: 'Safety' },
              { id: 'evidence', label: 'Evidence' },
              { id: 'metrics', label: 'Numbers' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-paper/70 hover:text-ink cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-caution-line/60 bg-caution-wash/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-caution lg:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-caution-wash0" />
              Synthetic
            </span>
            <button
              type="button"
              onClick={() => navigate('/clinic/start')}
              className="hidden rounded-full border border-rule-strong bg-paper/70 px-3.5 py-2 text-[12.5px] font-medium text-ink-2 backdrop-blur-xl transition-colors hover:border-rule-strong hover:text-ink sm:inline-flex cursor-pointer"
            >
              Open a clinic
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="group flex items-center gap-1.5 rounded-full bg-solid px-3.5 py-2 text-[12.5px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-solid active:translate-y-0 cursor-pointer"
            >
              <span>Physician desk</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative px-5 pb-10 pt-16 text-center sm:px-8 sm:pt-24">
          <Reveal>
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-rule/70 bg-paper/55 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-2 shadow-sm backdrop-blur-xl">
              <LiveDot size={6} color="var(--c-settled)" />
              Ambient intelligence · deterministic safety
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mx-auto mt-7 max-w-4xl text-[43px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[64px] lg:text-[80px]">
              Clinical intelligence,
              <br />
              <span className="bg-gradient-to-r from-solid via-solid to-accent bg-clip-text text-transparent">
                before you knock.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
              Proton reads the chart before the visit, listens during it, and enforces
              pharmaceutical safety at the moment of prescribing. Every diagnosis,
              note, and order waits for your signature.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="group flex items-center gap-2 rounded-full bg-solid px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(17,19,21,0.6)] transition-all hover:-translate-y-0.5 hover:bg-solid active:translate-y-0 cursor-pointer"
              >
                <span>Enter the synthetic desk</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => go('workbench')}
                className="flex items-center gap-2 rounded-full border border-rule/70 bg-paper/55 px-5 py-3.5 text-sm font-semibold text-ink backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-paper/80 active:translate-y-0 cursor-pointer"
              >
                See the workbench
                <ArrowUpRight className="h-4 w-4 text-ink-2" />
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-settled" /> Zero unapproved writes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-settled" /> HL7 FHIR R4
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-settled" /> Synthetic cohorts only
              </span>
            </div>
          </Reveal>
        </section>

        {/* ── Workbench ────────────────────────────────────────────────────── */}
        <section id="workbench" className="relative mx-auto mt-6 max-w-6xl px-4 sm:px-8">
          <Reveal delay={0.1}>
            <div className="proton-glass-strong proton-specular relative rounded-[30px] p-1.5 shadow-[0_50px_140px_-50px_rgba(16,18,22,0.5)] sm:p-2.5">
              <div className="overflow-hidden rounded-[24px] border border-rule/70 bg-paper/80">
                {/* Window chrome */}
                <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-2.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                      <span className="h-2.5 w-2.5 rounded-full bg-critical" />
                      <span className="h-2.5 w-2.5 rounded-full bg-caution" />
                      <span className="h-2.5 w-2.5 rounded-full bg-settled" />
                    </div>
                    <span className="text-[11px] font-medium tracking-[-0.01em] text-ink-2">
                      Proton · live encounter
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-settled-wash px-2 py-0.5 text-[10px] font-semibold text-settled">
                      <LiveDot size={5} color="var(--c-settled)" />
                      Connected
                    </span>
                    <span className="hidden font-mono-clinical text-[10px] text-ink-3 sm:inline">
                      FHIR R4 · 09:00
                    </span>
                  </div>
                </div>

                {/* Segmented tabs */}
                <div className="px-3 pt-3 sm:px-5">
                  <div
                    role="tablist"
                    aria-label="Encounter stages"
                    className="proton-segment flex items-center gap-1 rounded-2xl p-1"
                  >
                    {([
                      { id: 'brief', label: 'Pre-consult', index: '01' },
                      { id: 'safety', label: 'Rx safety', index: '02' },
                      { id: 'memory', label: 'Memory gate', index: '03' }
                    ] as const).map((tab) => (
                      <button
                        key={tab.id}
                        role="tab"
                        type="button"
                        aria-selected={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex-1 rounded-xl px-2 py-2 text-[11.5px] font-semibold transition-colors cursor-pointer sm:text-xs ${
                          activeTab === tab.id ? 'text-ink' : 'text-ink-2 hover:text-ink'
                        }`}
                      >
                        {activeTab === tab.id && (
                          <motion.span
                            layoutId="landing-tab-pill"
                            className="absolute inset-0 rounded-xl bg-paper shadow-[0_4px_14px_-6px_rgba(16,18,22,0.35)]"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          />
                        )}
                        <span className="relative z-10">
                          <span className="mr-1.5 hidden font-mono-clinical text-[9px] text-ink-3 sm:inline">
                            {tab.index}
                          </span>
                          {tab.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {activeTab === 'brief' && (
                    <motion.div key="brief" {...tabMotion} className="space-y-4 p-4 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-critical-wash to-caution-wash text-sm font-semibold text-critical">
                            EV
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-semibold tracking-[-0.02em]">Eleanor Vance</h2>
                              <span className="rounded-full bg-critical-wash px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-critical">
                                High acuity
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11.5px] text-ink-2">
                              68F · MRN pt-8841 · T2DM + resistant hypertension
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full border border-rule/80 bg-paper/70 px-2.5 py-1 font-mono-clinical text-[10px] text-ink-2">
                          EXAM 3 · 09:00
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-rule/80 bg-paper/65 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-2">
                              HbA1c
                            </span>
                            <span className="rounded-full bg-critical-wash px-1.5 py-0.5 font-mono-clinical text-[9.5px] font-semibold text-critical">
                              +1.1%
                            </span>
                          </div>
                          <div className="mt-1 flex items-end gap-2">
                            <span className="text-3xl font-semibold tracking-[-0.04em]">8.2%</span>
                            <span className="pb-1 font-mono-clinical text-[10px] text-ink-3">from 7.1%</span>
                          </div>
                          <Sparkline points={[7.1, 7.2, 7.0, 7.4, 7.6, 7.9, 8.2]} className="mt-2 h-8 w-full text-critical-on-solid0/80" />
                        </div>

                        <div className="rounded-2xl border border-rule/80 bg-paper/65 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-2">
                              Blood pressure
                            </span>
                            <span className="rounded-full bg-caution-wash px-1.5 py-0.5 font-mono-clinical text-[9.5px] font-semibold text-caution">
                              Stage 2
                            </span>
                          </div>
                          <div className="mt-1 flex items-end gap-2">
                            <span className="text-3xl font-semibold tracking-[-0.04em]">146/88</span>
                            <span className="pb-1 font-mono-clinical text-[10px] text-ink-3">mmHg</span>
                          </div>
                          <Sparkline points={[128, 132, 136, 134, 140, 143, 146]} className="mt-2 h-8 w-full text-caution-on-solid0/80" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-rule/80 bg-paper/65 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-2">
                            Note provenance
                          </span>
                          <button
                            type="button"
                            onClick={() => setProvenanceBadge(provenanceBadge === 'draft' ? 'edited' : 'draft')}
                            className="text-[11px] font-semibold text-accent-ink underline decoration-accent-ink/30 underline-offset-2 hover:decoration-accent-ink cursor-pointer"
                          >
                            Toggle clinician edit
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2.5">
                          {provenanceBadge === 'draft' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-caution-line/70 bg-caution-wash/80 px-2.5 py-1 text-[10.5px] font-semibold text-caution">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              AI draft — review required
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-settled-line/70 bg-settled-wash/80 px-2.5 py-1 text-[10.5px] font-semibold text-settled">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Clinician edited
                            </span>
                          )}
                          <span className="text-[11px] text-ink-2">
                            {provenanceBadge === 'draft'
                              ? 'Model synthesis — not part of the record'
                              : 'Signed by the treating physician'}
                          </span>
                        </div>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                          “Patient reports persistent morning lethargy and thirst. Metformin 1000 mg BID
                          continued without improvement.”
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'safety' && (
                    <motion.div key="safety" {...tabMotion} className="space-y-4 p-4 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-critical-wash text-critical">
                            <ShieldCheck className="h-4.5 w-4.5" />
                          </span>
                          <h2 className="text-lg font-semibold tracking-[-0.02em]">Deterministic pharmacology gate</h2>
                        </div>
                        <span className="rounded-full bg-critical px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                          Order blocked
                        </span>
                      </div>

                      <div className="rounded-2xl border border-critical-line/80 bg-critical-wash/70 p-4">
                        <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.11em] text-critical">
                          <AlertTriangle className="h-4 w-4" />
                          Critical cross-reactivity
                        </div>
                        <dl className="mt-2.5 grid gap-2 text-[12.5px] sm:grid-cols-3">
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.1em] text-critical-on-solid0">Attempted order</dt>
                            <dd className="mt-0.5 font-semibold text-critical">Amoxicillin 500 mg TID</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.1em] text-critical-on-solid0">Recorded allergy</dt>
                            <dd className="mt-0.5 font-semibold text-critical underline decoration-critical-on-solid">Penicillin · anaphylaxis</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.1em] text-critical-on-solid0">Rule</dt>
                            <dd className="mt-0.5 font-semibold text-critical">Beta-lactam core cross-sensitivity</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-2xl border border-caution-line/80 bg-caution-wash/60 p-4">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.11em] text-caution">
                          Prescription completeness audit
                        </div>
                        <ul className="mt-2 grid gap-1.5 text-[12.5px] text-ink-2 sm:grid-cols-2">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-settled" /> Drug · Lisinopril
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-settled" /> Dose · 10 mg
                          </li>
                          <li className="flex items-center gap-2 font-medium text-critical">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Frequency · missing
                          </li>
                          <li className="flex items-center gap-2 font-medium text-critical">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Duration · missing
                          </li>
                        </ul>
                      </div>

                      <p className="text-[11px] text-ink-2">
                        Rules run server-side against the confirmed allergy list. A language model cannot
                        override a hard stop.
                      </p>
                    </motion.div>
                  )}

                  {activeTab === 'memory' && (
                    <motion.div key="memory" {...tabMotion} className="space-y-4 p-4 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-wash text-accent-ink">
                            <Database className="h-4.5 w-4.5" />
                          </span>
                          <h2 className="text-lg font-semibold tracking-[-0.02em]">Post-visit memory gating</h2>
                        </div>
                        <span className="font-mono-clinical text-[10px] text-ink-3">medplum.executeBatch()</span>
                      </div>

                      <p className="text-[12.5px] leading-relaxed text-ink-2">
                        Proposed changes are staged, diffed, and written only after you approve them.
                        Nothing here reaches the patient record automatically.
                      </p>

                      <ul className="space-y-2">
                        {[
                          { label: 'New condition', value: 'Diabetic peripheral neuropathy', code: 'E11.40' },
                          { label: 'Titration', value: 'Lisinopril 10 mg → 20 mg daily', code: 'ATC C09AA03' }
                        ].map((proposal) => (
                          <li
                            key={proposal.code}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rule/80 bg-paper/65 px-4 py-3"
                          >
                            <div>
                              <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                                {proposal.label}
                              </div>
                              <div className="mt-0.5 text-[13px] font-medium">{proposal.value}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-settled-line bg-settled-wash px-2 py-0.5 text-[10px] font-semibold text-settled">
                                Approved
                              </span>
                              <span className="font-mono-clinical text-[9.5px] text-ink-3">{proposal.code}</span>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={() => setIsCommitted(true)}
                        disabled={isCommitted}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-semibold transition-all ${
                          isCommitted
                            ? 'cursor-default bg-settled text-white'
                            : 'cursor-pointer bg-solid text-white hover:-translate-y-0.5 hover:bg-solid'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {isCommitted
                          ? 'Atomic FHIR batch committed · 200 OK'
                          : 'Commit approved memory to Medplum'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] px-4 py-3 sm:px-5">
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] text-ink-2">
                    <Lock className="h-3 w-3" />
                    Physician signature required for every write
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="group flex items-center gap-1 text-[11.5px] font-semibold text-accent-ink cursor-pointer"
                  >
                    Open full desk
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Floating context cards */}
          <div className="pointer-events-none absolute -left-3 top-40 hidden xl:block">
            <Reveal delay={0.32}>
              <div className="proton-glass rounded-2xl px-4 py-3 shadow-xl">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  Ambient capture
                </div>
                <div className="mt-1 flex items-center gap-2 text-[12px] font-medium">
                  <LiveDot size={6} color="var(--c-settled)" />
                  Listening · 2 speakers
                </div>
              </div>
            </Reveal>
          </div>
          <div className="pointer-events-none absolute -right-4 top-72 hidden xl:block">
            <Reveal delay={0.4}>
              <div className="proton-glass rounded-2xl px-4 py-3 shadow-xl">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  Allergy guard
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-critical">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Penicillin blocked
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Platform bento ───────────────────────────────────────────────── */}
        <section id="platform" className="relative mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-2">The platform</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-[44px] sm:leading-[1.08]">
                One room. One record. One signature.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2 sm:text-base">
                Proton is not another chat window beside the EHR. It is the encounter
                workflow — brief, capture, draft, safety, signature, report, follow-up.
              </p>
            </div>
          </Reveal>

          <Stagger className="mt-10 grid gap-4 md:grid-cols-6" stagger={0.07}>
            <StaggerItem className="proton-glass proton-specular rounded-[26px] p-5 md:col-span-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-wash text-accent-ink">
                    <Mic className="h-4 w-4" />
                  </span>
                  <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">
                    Ambient capture that knows who is speaking
                  </h3>
                  <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-2">
                    Speaker-labelled transcript, word timestamps, and a live draft you can
                    correct while the patient is still in the room.
                  </p>
                </div>
                <span className="rounded-full bg-settled-wash px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-settled">
                  Live
                </span>
              </div>

              <div className="mt-4 space-y-1.5 rounded-2xl border border-rule/80 bg-paper/55 p-3.5">
                <div className="flex gap-2.5">
                  <span className="mt-0.5 w-12 shrink-0 font-mono-clinical text-[9px] uppercase text-ink-3">Doctor</span>
                  <span className="text-[12px] text-ink-2">Any dizziness when you stand up in the morning?</span>
                </div>
                <div className="flex gap-2.5">
                  <span className="mt-0.5 w-12 shrink-0 font-mono-clinical text-[9px] uppercase text-ink-3">Patient</span>
                  <span className="text-[12px] text-ink-2">A little, mostly before breakfast. It passes after I eat.</span>
                </div>
                <div className="flex items-center gap-1.5 pl-[3.6rem]">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-accent" />
                  <span className="font-mono-clinical text-[9.5px] text-ink-3">transcribing · 00:14</span>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem id="safety" className="proton-glass proton-specular rounded-[26px] p-5 md:col-span-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-critical-wash text-critical">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">Hard safety stops</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                Allergy, interaction, dose, and completeness rules run server-side. No model
                can approve past them.
              </p>
              <div className="mt-4 rounded-2xl border border-critical-line/70 bg-critical-wash/70 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-critical">
                  <AlertTriangle className="h-3.5 w-3.5" /> Blocked
                </div>
                <div className="mt-1 text-[12px] font-medium text-critical">Amoxicillin · penicillin anaphylaxis</div>
              </div>
            </StaggerItem>

            <StaggerItem id="evidence" className="proton-glass proton-specular rounded-[26px] p-5 md:col-span-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-wash text-accent-ink">
                <Database className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">Grounded in evidence</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                Every suggestion carries a citation or an explicit “no evidence” flag.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['NICE NG28', 'ADA 2026', 'KDIGO', 'RxNorm'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-rule/80 bg-paper/70 px-2 py-0.5 font-mono-clinical text-[9.5px] text-ink-2"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </StaggerItem>

            <StaggerItem className="proton-glass proton-specular rounded-[26px] p-5 md:col-span-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-md">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-settled-wash text-settled">
                    <Lock className="h-4 w-4" />
                  </span>
                  <h3 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">
                    Nothing is written until you sign
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                    AI drafts, the physician attests. Every transition is versioned,
                    audited, and replayable — including who signed, and when.
                  </p>
                </div>
                <div className="min-w-[190px] rounded-2xl border border-settled-line/70 bg-settled-wash/60 px-3.5 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-settled">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Signed
                  </div>
                  <div className="mt-1 text-[12px] font-medium text-settled">Dr. Sarah Lin, MD</div>
                  <div className="mt-0.5 font-mono-clinical text-[9.5px] text-settled">NPI 1928374650 · 09:42</div>
                </div>
              </div>
            </StaggerItem>
          </Stagger>
        </section>

        {/* ── Metrics ──────────────────────────────────────────────────────── */}
        <section id="metrics" className="relative mx-auto max-w-6xl px-5 pb-20 sm:px-8 sm:pb-24">
          <Reveal>
            <div className="proton-glass-strong proton-specular grid grid-cols-2 gap-y-8 rounded-[30px] px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-4">
              {[
                { value: 10, suffix: 's', label: 'Pre-consult brief', detail: 'Longitudinal trend extraction' },
                { value: 100, suffix: '%', label: 'Deterministic Rx gate', detail: 'Cross-allergy + completeness' },
                { value: 13, suffix: '', label: 'Encounter states', detail: 'Booked → closed, auditable' },
                { value: 0, suffix: '', label: 'Unapproved writes', detail: 'Physician signature required', raw: 'FHIR R4' }
              ].map((metric) => (
                <div key={metric.label} className="px-1 text-center lg:text-left">
                  <div className="text-[34px] font-semibold tracking-[-0.045em] tabular-nums sm:text-[40px]">
                    {metric.raw ? (
                      metric.raw
                    ) : (
                      <>
                        <CountUp value={metric.value} suffix={metric.suffix} />
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-[11.5px] font-semibold text-ink">{metric.label}</div>
                  <div className="mt-0.5 text-[10.5px] leading-snug text-ink-3">{metric.detail}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <Reveal>
            <div className="proton-glass-strong relative overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-12 sm:py-20">
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-critical-wash/50 blur-3xl" />
                <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-accent-wash/60 blur-3xl" />
              </div>
              <div className="relative">
                <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-rule/80 bg-paper/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">
                  <Sparkles className="h-3 w-3 text-accent-ink" />
                  Synthetic validation cohort
                </div>
                <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-[46px] sm:leading-[1.05]">
                  Run one encounter end to end.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-ink-2 sm:text-[15px]">
                  Book, capture, draft, sign, report, follow up. No fixture data, no
                  silent writes — just the loop, working.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="group flex items-center gap-2 rounded-full bg-solid px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(17,19,21,0.6)] transition-all hover:-translate-y-0.5 hover:bg-solid active:translate-y-0 cursor-pointer"
                  >
                    Enter the physician desk
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go('workbench')}
                    className="rounded-full border border-rule/80 bg-paper/60 px-5 py-3.5 text-sm font-semibold text-ink backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-paper/90 active:translate-y-0 cursor-pointer"
                  >
                    Replay the workbench
                  </button>
                </div>
                <p className="mt-6 inline-flex items-center gap-1.5 text-[10.5px] text-ink-3">
                  <Activity className="h-3 w-3" />
                  No real PHI · Eleanor Vance &amp; Arthur Pendelton synthetic cohorts
                </p>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-black/[0.06] bg-paper/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-[11px] text-ink-2 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-solid text-[10px] font-bold text-white">p</span>
            <span className="font-semibold text-ink">Proton</span>
            <span>· Controlled physician validation environment</span>
          </div>
          <div className="font-mono-clinical text-[10px] text-ink-3">
            HL7 FHIR R4 · Ambient intelligence · 100% synthetic cohorts
          </div>
        </div>
      </footer>
    </div>
  );
}
