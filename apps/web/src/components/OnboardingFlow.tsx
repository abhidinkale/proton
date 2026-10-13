import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Users,
  FileText,
  Mic,
  ShieldCheck,
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronRight,
  Check,
  Clock,
  Pill,
  TrendingUp,
  ShieldAlert,
  Stethoscope,
  Sparkle
} from 'lucide-react';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

const STORAGE_KEY = 'proton_onboarding_complete';
const TOTAL_STEPS = 6;

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Unable to persist onboarding completion state', e);
    }
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Unable to persist onboarding completion state', e);
    }
    onSkip();
  }, [onSkip]);

  const handleOpenDemoPatient = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Unable to persist onboarding completion state', e);
    }
    onComplete();
    navigate('/patients');
  }, [onComplete, navigate]);

  const goToNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const goToPrev = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Keyboard navigation: Escape to skip, Arrow keys to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' && currentStep < TOTAL_STEPS) {
        goToNext();
      } else if (e.key === 'ArrowLeft' && currentStep > 1) {
        goToPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, goToNext, goToPrev, handleSkip]);

  const isDarkMode = currentStep === 1;

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col overflow-y-auto transition-colors duration-500 backdrop-blur-md ${
        isDarkMode 
          ? 'bg-slate-950 text-slate-100 proton-grid-pattern' 
          : 'bg-slate-50/95 text-slate-900'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Proton Onboarding Tour"
    >
      {/* ── TOP HEADER / STEP INDICATOR BAR ── */}
      <header 
        className={`sticky top-0 z-20 px-4 sm:px-8 py-4 transition-colors duration-300 border-b ${
          isDarkMode 
            ? 'bg-slate-950/90 border-slate-800/80' 
            : 'bg-white/90 border-slate-200/80 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Clinical Badge */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-bold tracking-tight text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  PROTON
                </span>
                <span className="proton-micro-label px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  Physician Tour
                </span>
              </div>
              <p className={`text-[11px] font-medium hidden sm:block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                AI-Native Clinical Copilot
              </p>
            </div>
          </div>

          {/* Stepper with connecting lines */}
          <div className="flex flex-col items-center">
            <span className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <div className="flex items-center">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, index) => {
                const isCompleted = s < currentStep;
                const isCurrent = s === currentStep;

                return (
                  <div key={s} className="flex items-center">
                    {/* Step Node */}
                    <button
                      onClick={() => setCurrentStep(s)}
                      aria-label={`Go to step ${s}`}
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-brand-600 text-white ring-4 ring-brand-500/25 scale-110 shadow-sm'
                          : isCompleted
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : isDarkMode
                              ? 'bg-slate-900 border border-slate-700 text-slate-500 hover:text-slate-300'
                              : 'bg-slate-100 border border-slate-300 text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {isCompleted ? <Check size={13} strokeWidth={3} /> : s}
                    </button>

                    {/* Connecting Line */}
                    {index < TOTAL_STEPS - 1 && (
                      <div
                        className={`h-[2px] w-4 sm:w-8 md:w-12 transition-colors duration-300 ${
                          s < currentStep
                            ? 'bg-emerald-600'
                            : isDarkMode
                              ? 'bg-slate-800'
                              : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skip / Close Link */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkip}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                isDarkMode 
                  ? 'text-slate-400 hover:text-white hover:bg-slate-900' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Skip tutorial</span>
              <X size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ── STEP CONTENT CONTAINER ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex items-center">
        <div key={currentStep} className="w-full proton-animate-in">
          {currentStep === 1 && (
            <StepOneWelcome onNext={goToNext} onSkip={handleSkip} />
          )}

          {currentStep === 2 && (
            <StepTwoCommandCenter onNext={goToNext} onPrev={goToPrev} />
          )}

          {currentStep === 3 && (
            <StepThreePatientIntelligence onNext={goToNext} onPrev={goToPrev} />
          )}

          {currentStep === 4 && (
            <StepFourConsultation onNext={goToNext} onPrev={goToPrev} />
          )}

          {currentStep === 5 && (
            <StepFiveVerifyApprove onNext={goToNext} onPrev={goToPrev} />
          )}

          {currentStep === 6 && (
            <StepSixLongitudinalMemory 
              onPrev={goToPrev} 
              onComplete={handleComplete} 
              onOpenDemo={handleOpenDemoPatient} 
            />
          )}
        </div>
      </main>

      {/* ── BOTTOM FOOTER BAR ── */}
      <footer 
        className={`px-4 sm:px-8 py-3.5 border-t text-xs transition-colors duration-300 ${
          isDarkMode 
            ? 'bg-slate-950/80 border-slate-850 text-slate-500' 
            : 'bg-white/80 border-slate-200 text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Proton Clinical Platform</span>
            <span>&bull;</span>
            <span>Synthetic Evaluation Environment</span>
            <span>&bull;</span>
            <span className="text-amber-500 font-medium">Physician Approval Gated</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Use <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>&larr;</kbd> <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>&rarr;</kbd> to navigate</span>
            <span>&bull;</span>
            <span>Press <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>Esc</kbd> to exit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ========================================================================== */
/* STEP 1: WELCOME TO PROTON                                                  */
/* ========================================================================== */
function StepOneWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
          <Sparkles size={13} className="text-brand-400" />
          <span>Next-Generation Clinical Workflow</span>
        </div>

        <div className="space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-brand-500/25 mb-4">
            <Activity size={36} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Welcome to Proton
          </h1>
          <p className="text-xl sm:text-2xl font-medium text-brand-300">
            Your clinical copilot.
          </p>
        </div>

        <p className="text-slate-300 text-base leading-relaxed">
          Proton helps you understand patient context, document consultations, review clinical information, and build a longitudinal patient story.
        </p>

        {/* Feature highlight pills */}
        <div className="space-y-2.5 pt-2">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Physician-in-the-loop safety</p>
              <p className="text-xs text-slate-400">Zero unsupervised AI writes to EHR. You review, verify, and approve every order.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
              <Brain size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Longitudinal clinical memory</p>
              <p className="text-xs text-slate-400">Approved findings build the ongoing patient story across future appointments.</p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={onNext}
            className="proton-btn proton-btn-primary px-6 py-3.5 text-sm rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Show me around</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={onSkip}
            className="proton-btn proton-btn-ghost text-slate-400 hover:text-white text-sm font-semibold cursor-pointer"
          >
            Skip tutorial
          </button>
        </div>
      </div>

      {/* Right Visual Mockup Column */}
      <div className="lg:col-span-7">
        <div className="relative rounded-2xl p-1 bg-gradient-to-br from-brand-500/30 via-slate-800 to-indigo-500/20 shadow-2xl">
          <div className="bg-slate-900 rounded-[14px] p-6 text-slate-200 space-y-5 border border-slate-800/80">
            {/* Header telemetry */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold tracking-wide uppercase text-slate-300">
                  Proton Clinical Command Cockpit
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                FHIR R4 Connected
              </span>
            </div>

            {/* Quick Preview Modules */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <Users size={16} />
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Ready</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">Patient Intelligence</p>
                <p className="text-[11px] text-slate-400">Pre-visit briefings in 30 seconds</p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <Mic size={16} />
                  <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">Ambient</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">Consultation Scribe</p>
                <p className="text-[11px] text-slate-400">Instant multi-speaker SOAP drafts</p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Gated</span>
                </div>
                <p className="text-xs font-semibold text-slate-200">Safety & Verification</p>
                <p className="text-[11px] text-slate-400">Deterministic allergy & drug checks</p>
              </div>
            </div>

            {/* Spotlight Card: Eleanor Vance */}
            <div className="bg-gradient-to-r from-brand-950/60 via-slate-850 to-indigo-950/60 border border-brand-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-brand-600/30 border border-brand-400/40 text-brand-300 flex items-center justify-center font-bold text-sm shrink-0">
                  EV
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">Eleanor Vance, 42y Female</p>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300">
                      Demo Case
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Type 2 Diabetes &bull; Essential Hypertension &bull; Penicillin Anaphylaxis Alert
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> 3 Signals Prepped
                </span>
                <span className="text-[10px] text-slate-400">Ready for clinic</span>
              </div>
            </div>

            {/* Micro quote banner */}
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <Sparkle size={14} className="text-violet-400" />
                Designed specifically for physician speed, cognitive ease, and diagnostic safety.
              </span>
              <span className="text-[11px] font-mono text-slate-500">v1.0-beta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* STEP 2: YOUR COMMAND CENTER                                                */
/* ========================================================================== */
function StepTwoCommandCenter({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold">
          <Activity size={13} className="text-brand-600" />
          <span>Step 2 &bull; Daily Clinical Triage</span>
        </div>

        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Your Command Center
          </h2>
          <p className="text-base sm:text-lg font-medium text-slate-600 mt-2">
            This is where Proton tells you what needs your attention today.
          </p>
        </div>

        <p className="text-slate-600 text-sm leading-relaxed">
          Start every clinic shift with clarity. Rather than navigating disconnected inboxes and EMR queues, Proton brings together pending safety flags, unfinalized consult drafts, and incoming documents into a single prioritized workspace.
        </p>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="proton-badge bg-red-50 text-red-800 border border-red-200 py-1 px-2.5">
            <AlertTriangle size={12} className="text-red-600" />
            Safety Alert Triage
          </span>
          <span className="proton-badge bg-amber-50 text-amber-800 border border-amber-200 py-1 px-2.5">
            <Clock size={12} className="text-amber-600" />
            Unfinished Draft Queue
          </span>
          <span className="proton-badge bg-indigo-50 text-indigo-800 border border-indigo-200 py-1 px-2.5">
            <FileText size={12} className="text-indigo-600" />
            External Document Review
          </span>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={onPrev}
            className="proton-btn proton-btn-secondary px-5 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            onClick={onNext}
            className="proton-btn proton-btn-primary px-6 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Next: Patient Intelligence</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Right Visual Mockup Column */}
      <div className="lg:col-span-7">
        <div className="proton-card p-5 sm:p-6 bg-white border border-slate-200 shadow-md space-y-5">
          {/* Dashboard Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Today's Clinic Dashboard</h3>
              <p className="text-[11px] text-slate-500">Dr. Eleanor Vance, MD &bull; General Internal Medicine</p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              ● All Systems Live
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase">Patients</span>
                <Users size={14} className="text-brand-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">24</p>
              <p className="text-[10px] text-slate-500">4 with pending labs</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase">Consultations</span>
                <Mic size={14} className="text-indigo-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">8</p>
              <p className="text-[10px] text-slate-500">2 pending signature</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase">Documents</span>
                <FileText size={14} className="text-amber-600" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">3</p>
              <p className="text-[10px] text-slate-500">1 urgent pathology</p>
            </div>
          </div>

          {/* Needs Your Attention Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wide">
                <AlertTriangle size={14} className="text-amber-600" />
                <span>Needs Your Attention</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                3 Pending
              </span>
            </div>

            {/* Item 1: Safety Alert */}
            <div className="p-3 rounded-xl bg-red-50/50 border border-red-200 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-red-100 text-red-700 shrink-0 mt-0.5">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-950">Safety Alert &bull; Allergy Conflict</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-red-200/60 text-red-800">Critical</span>
                  </div>
                  <p className="text-[11px] text-red-800 font-medium">Eleanor Vance (42y)</p>
                  <p className="text-[11px] text-slate-600">Amoxicillin draft contraindicated by documented Penicillin anaphylaxis.</p>
                </div>
              </div>
              <button className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-red-700 border border-red-300 hover:bg-red-50 shrink-0 inline-flex items-center gap-1">
                <span>Review</span>
                <ChevronRight size={12} />
              </button>
            </div>

            {/* Item 2: Unfinished Draft */}
            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-950">Unfinished Consultation Draft</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-200/60 text-amber-800">Today 09:15</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">Marcus Chen (58y)</p>
                  <p className="text-[11px] text-slate-600">Cardiology follow-up audio captured &bull; SOAP draft awaiting physician sign.</p>
                </div>
              </div>
              <button className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-amber-800 border border-amber-300 hover:bg-amber-50 shrink-0 inline-flex items-center gap-1">
                <span>Resume</span>
                <ChevronRight size={12} />
              </button>
            </div>

            {/* Item 3: Document to Review */}
            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                  <FileText size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-950">Document to Review</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-200/60 text-indigo-800">Biopsy PDF</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 font-medium">Sarah Jenkins (36y)</p>
                  <p className="text-[11px] text-slate-600">External surgical pathology report &bull; 4 clinical findings extracted.</p>
                </div>
              </div>
              <button className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-indigo-800 border border-indigo-300 hover:bg-indigo-50 shrink-0 inline-flex items-center gap-1">
                <span>Verify</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* STEP 3: PATIENT INTELLIGENCE                                               */
/* ========================================================================== */
function StepThreePatientIntelligence({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold">
          <Users size={13} className="text-brand-600" />
          <span>Step 3 &bull; Pre-Consultation Synthesis</span>
        </div>

        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Patient Intelligence
          </h2>
          <p className="text-base sm:text-lg font-medium text-slate-600 mt-2">
            Before you see the patient, Proton summarizes what matters.
          </p>
        </div>

        <p className="text-slate-600 text-sm leading-relaxed">
          No more scanning 40 pages of past encounters or deciphering outside lab PDFs right before entering the exam room. Proton synthesizes what has changed, flags allergies, and visualizes the longitudinal timeline in an instant 30-second briefing.
        </p>

        {/* Highlight bullets */}
        <div className="space-y-2 pt-1 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>What Matters Today:</strong> Dynamic delta tracking between past and current visits</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>Objective Lab Trajectory:</strong> Automatic detection of out-of-range clinical shifts</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>Chronological Timeline:</strong> Unified timeline spanning multiple specialties and encounters</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={onPrev}
            className="proton-btn proton-btn-secondary px-5 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            onClick={onNext}
            className="proton-btn proton-btn-primary px-6 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Next: Consultation Workflow</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Right Visual Mockup Column */}
      <div className="lg:col-span-7">
        <div className="proton-card p-5 sm:p-6 bg-white border border-slate-200 shadow-md space-y-4">
          {/* Patient Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                EV
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Eleanor Vance</h3>
                  <span className="text-xs text-slate-500 font-medium">42y &bull; Female</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    MRN: #94821
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Type 2 Diabetes
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Hypertension
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex items-center gap-1">
              <Sparkles size={11} /> Briefing Ready
            </span>
          </div>

          {/* What Matters Today Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles size={13} className="text-brand-600" />
                What Matters Today
              </span>
              <span className="text-[10px] text-slate-500">Synthesized 2m ago</span>
            </div>

            {/* Allergies Item */}
            <div className="p-2.5 rounded-xl bg-red-50/70 border border-red-200 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-red-100 text-red-700 shrink-0 mt-0.5">
                <AlertTriangle size={14} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-red-900">Allergy Warning: Penicillin</span>
                <p className="text-slate-700 mt-0.5">Documented severe anaphylaxis. Strict beta-lactam avoidance required.</p>
              </div>
            </div>

            {/* Lab Changes Item */}
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                <TrendingUp size={14} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-amber-900">Lab Shift: HbA1c 7.1% &rarr; 8.4%</span>
                <p className="text-slate-700 mt-0.5">Elevated HbA1c from Quest Diagnostics 5 days ago indicates worsening glycemic control.</p>
              </div>
            </div>

            {/* Medication Changes Item */}
            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-sky-100 text-sky-700 shrink-0 mt-0.5">
                <Pill size={14} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-sky-900">Medication Change: Lisinopril 20mg</span>
                <p className="text-slate-700 mt-0.5">Titrated up by Nephrology 3 weeks ago. Recent BP averaging 124/80 mmHg.</p>
              </div>
            </div>
          </div>

          {/* Clinical Timeline Preview */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-2">
              Clinical Timeline
            </span>
            <div className="relative pl-4 space-y-2 border-l-2 border-slate-200 text-xs text-slate-600">
              <div className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white"></span>
                <span className="font-semibold text-slate-900">Today:</span> Follow-up Consultation &bull; Diabetes & HTN Review
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-400 ring-2 ring-white"></span>
                <span className="font-medium text-slate-700">5 days ago:</span> Outpatient Lab &bull; HbA1c 8.4%, eGFR &gt; 60
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-400 ring-2 ring-white"></span>
                <span className="font-medium text-slate-700">3 weeks ago:</span> Nephrology Visit &bull; Lisinopril dose increase
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* STEP 4: CLINICAL CONSULTATION                                              */
/* ========================================================================== */
function StepFourConsultation({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold">
          <Mic size={13} className="text-brand-600" />
          <span>Step 4 &bull; Ambient Documentation</span>
        </div>

        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Clinical Consultation
          </h2>
          <p className="text-base sm:text-lg font-medium text-slate-600 mt-2">
            During the consultation, Proton helps turn the conversation into structured clinical documentation.
          </p>
        </div>

        {/* Emphasized safety gate */}
        <div className="p-3.5 rounded-xl bg-brand-50/80 border border-brand-200 text-brand-950 text-xs font-medium space-y-1">
          <span className="font-bold text-brand-900 flex items-center gap-1.5 text-sm">
            <ShieldCheck size={16} className="text-brand-700" />
            The physician remains in control at every stage.
          </span>
          <p className="text-brand-800 leading-relaxed">
            AI listens and drafts in real time, but never writes to the chart autonomously. You edit, refine, or approve with one click.
          </p>
        </div>

        {/* Workflow stages */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consultation Workflow</span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="font-bold text-slate-900 block">1. Record</span>
              <span className="text-[10px] text-slate-500">Ambient audio</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200">
              <span className="font-bold text-slate-900 block">2. Transcript</span>
              <span className="text-[10px] text-slate-500">Speaker separated</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-brand-200 bg-brand-50/30">
              <span className="font-bold text-brand-700 block">3. AI Draft</span>
              <span className="text-[10px] text-brand-600">Structured SOAP</span>
            </div>
          </div>
        </div>

        {/* Provenance Badges Explainer */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Provenance Badges</span>
          <div className="flex flex-wrap gap-2">
            <span className="proton-badge bg-violet-50 text-violet-800 border border-violet-200">
              <Sparkles size={11} className="text-violet-600" /> AI DRAFT
            </span>
            <span className="proton-badge bg-sky-50 text-sky-800 border border-sky-200">
              PHYSICIAN EDITED
            </span>
            <span className="proton-badge bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck size={11} className="text-emerald-600" /> PHYSICIAN APPROVED
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={onPrev}
            className="proton-btn proton-btn-secondary px-5 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            onClick={onNext}
            className="proton-btn proton-btn-primary px-6 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Next: Verify & Approve</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Right Visual Mockup Column */}
      <div className="lg:col-span-7">
        <div className="proton-card p-5 sm:p-6 bg-white border border-slate-200 shadow-md space-y-4">
          {/* Active Recording Waveform Header */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider">Active Ambient Scribe</span>
                <p className="text-[10px] text-slate-400">Dr. Vance &bull; Eleanor Vance (14:22)</p>
              </div>
            </div>
            {/* Visualizer bars */}
            <div className="flex items-center gap-1 h-5">
              <span className="w-1 bg-brand-400 h-2 rounded-full animate-pulse"></span>
              <span className="w-1 bg-brand-400 h-4 rounded-full animate-pulse" style={{ animationDelay: '100ms' }}></span>
              <span className="w-1 bg-brand-400 h-5 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
              <span className="w-1 bg-brand-400 h-3 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
              <span className="w-1 bg-brand-400 h-4 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
            </div>
          </div>

          {/* Transcript Snippet */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Live Speaker Stream</span>
              <span className="text-emerald-700">99.4% Confidence</span>
            </div>
            <div className="space-y-1.5 text-slate-700">
              <p>
                <strong className="text-slate-900 font-semibold">Dr. Vance:</strong> "Good morning Eleanor. Your recent HbA1c is 8.4%. Any side effects on the Lisinopril?"
              </p>
              <p>
                <strong className="text-slate-900 font-semibold">Eleanor:</strong> "No dizziness, but I've had some tingling in my toes lately."
              </p>
              <p>
                <strong className="text-slate-900 font-semibold">Dr. Vance:</strong> "Let's increase Metformin to 1000mg twice daily with meals and evaluate the numbness."
              </p>
            </div>
          </div>

          {/* Structured Note Draft Preview */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Synthesized Clinical Note
              </span>
              <span className="proton-badge bg-violet-50 text-violet-800 border border-violet-200">
                <Sparkles size={11} className="text-violet-600" /> AI DRAFT
              </span>
            </div>

            {/* Assessment */}
            <div className="text-xs space-y-1 border-l-2 border-violet-400 pl-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Assessment:</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-100 text-violet-800 font-semibold">AI Synthesized</span>
              </div>
              <p className="text-slate-700">
                1. Type 2 Diabetes Mellitus with worsening glycemic control (recent HbA1c 8.4%).
                <br />
                2. Early bilateral peripheral neuropathy (subtle distal paresthesia).
              </p>
            </div>

            {/* Plan */}
            <div className="text-xs space-y-1 border-l-2 border-sky-400 pl-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Plan:</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-semibold">PHYSICIAN EDITED</span>
              </div>
              <p className="text-slate-700">
                Titrate Metformin from 500mg BID to 1000mg PO BID with meals. Recheck HbA1c in 90 days. Recommend diabetic foot exam.
              </p>
            </div>

            {/* Objective Vitals */}
            <div className="text-xs space-y-1 border-l-2 border-emerald-400 pl-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Objective Vitals:</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">PHYSICIAN APPROVED</span>
              </div>
              <p className="text-slate-700">
                BP 124/80 mmHg &bull; HR 72 bpm &bull; BMI 27.2 &bull; Monofilament exam pending.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* STEP 5: VERIFY + APPROVE                                                   */
/* ========================================================================== */
function StepFiveVerifyApprove({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold">
          <ShieldCheck size={13} className="text-brand-600" />
          <span>Step 5 &bull; Clinical Safety Gate</span>
        </div>

        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Verify & Approve
          </h2>
          <p className="text-lg sm:text-xl font-bold text-brand-700 mt-2">
            AI drafts. Proton verifies. You decide.
          </p>
        </div>

        <p className="text-slate-600 text-sm leading-relaxed">
          Proton never assumes AI output is clinically flawless. Before any clinical draft is signed, deterministic safety rules check for drug-allergy conflicts, dosage parameters, and missing fields.
        </p>

        {/* Safety Principles */}
        <div className="space-y-2 text-xs text-slate-700 pt-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>Deterministic rule engine:</strong> Safe execution rules, not probabilistic guesses</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>Hard conflict blocking:</strong> Prevents contraindicated medications from being signed</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>Immutable provenance:</strong> Clear audit trail connecting clinical drafts to doctor sign-off</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={onPrev}
            className="proton-btn proton-btn-secondary px-5 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            onClick={onNext}
            className="proton-btn proton-btn-primary px-6 py-2.5 text-xs rounded-xl font-bold flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Next: Longitudinal Memory</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Right Visual Mockup Column */}
      <div className="lg:col-span-7">
        <div className="proton-card p-5 sm:p-6 bg-white border border-slate-200 shadow-md space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Clinical Safety & Verification</h3>
                <p className="text-[11px] text-slate-500">Deterministic checks evaluated before EHR persistence</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              1 Conflict Flagged
            </span>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-2.5">
            {/* Check 1 */}
            <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-emerald-950">Required fields present</span>
                <p className="text-slate-600 mt-0.5">Subjective, Objective, Assessment, and Plan all properly structured with clinical detail.</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded ml-auto shrink-0">
                Passed
              </span>
            </div>

            {/* Check 2: Conflict */}
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                <AlertTriangle size={14} />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-950">Allergy conflict detected</span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                    Action Blocked
                  </span>
                </div>
                <p className="text-slate-700 mt-0.5">
                  Suggested Amoxicillin draft blocked by documented Penicillin Anaphylaxis. Replaced with Azithromycin 250mg.
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded ml-auto shrink-0">
                Resolved
              </span>
            </div>

            {/* Check 3 */}
            <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-emerald-950">No duplicate medication</span>
                <p className="text-slate-600 mt-0.5">Metformin 1000mg correctly supersedes previous 500mg dose without duplicate order.</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded ml-auto shrink-0">
                Passed
              </span>
            </div>
          </div>

          {/* Physician Sign-Off Action Mockup */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900">Physician Approval Gate</span>
                <span className="proton-badge bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px]">
                  Ready to Sign
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Dr. Eleanor Vance, MD &bull; NPI #1982736410</p>
            </div>

            <button className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
              <ShieldCheck size={14} />
              <span>Approve & Sign Note</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* STEP 6: LONGITUDINAL MEMORY                                                */
/* ========================================================================== */
function StepSixLongitudinalMemory({
  onPrev,
  onComplete,
  onOpenDemo
}: {
  onPrev: () => void;
  onComplete: () => void;
  onOpenDemo: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold">
          <Brain size={13} className="text-brand-600" />
          <span>Step 6 &bull; Longitudinal Patient Memory</span>
        </div>

        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Longitudinal Memory
          </h2>
          <p className="text-lg sm:text-xl font-bold text-brand-700 mt-2">
            Approved information becomes part of the patient's story.
          </p>
        </div>

        <p className="text-slate-600 text-sm leading-relaxed">
          Approved information becomes part of the patient's story. AI remembers only what you approve. When this consultation ends, Proton automatically extracts updates so Eleanor's next visit begins with complete context.
        </p>

        {/* Value Callouts */}
        <div className="space-y-2 text-xs text-slate-700 pt-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>Zero chart amnesia:</strong> Medication changes and symptoms follow the patient</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>Physician gate required:</strong> Memory proposals require doctor acceptance</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span><strong>FHIR R4 Native:</strong> Persisted directly to standard healthcare resources</span>
          </div>
        </div>

        {/* Primary & Secondary Action CTAs */}
        <div className="space-y-3 pt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={onComplete}
              className="proton-btn proton-btn-primary px-6 py-3 text-sm rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Start Using Proton</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={onOpenDemo}
              className="proton-btn proton-btn-secondary px-5 py-3 text-sm rounded-xl font-bold flex items-center justify-center gap-2 border-brand-200 text-brand-700 hover:bg-brand-50 cursor-pointer"
            >
              <Users size={16} />
              <span>Open Eleanor Vance</span>
            </button>
          </div>

          <div>
            <button
              onClick={onPrev}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Step 5</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Visual Mockup Column */}
      <div className="lg:col-span-7">
        <div className="proton-card p-5 sm:p-6 bg-white border border-slate-200 shadow-md space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs">
                <Brain size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  PATIENT MEMORY UPDATE PROPOSALS
                </h3>
                <p className="text-[11px] text-slate-500">Proposed longitudinal changes from Eleanor Vance visit</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              Physician Gated
            </span>
          </div>

          {/* Memory Proposal Items */}
          <div className="space-y-2.5">
            {/* Proposal 1: Medication changed */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-700 flex items-center gap-1">
                  <Pill size={13} /> + Medication changed
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check size={11} strokeWidth={3} /> Approved
                </span>
              </div>
              <p className="font-semibold text-slate-900">Metformin titrated to 1000mg BID</p>
              <p className="text-slate-500 text-[11px]">Supersedes previous 500mg BID dose due to recent elevated HbA1c (8.4%).</p>
            </div>

            {/* Proposal 2: New clinical finding */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-700 flex items-center gap-1">
                  <Stethoscope size={13} /> + New clinical finding
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check size={11} strokeWidth={3} /> Approved
                </span>
              </div>
              <p className="font-semibold text-slate-900">Early diabetic peripheral neuropathy</p>
              <p className="text-slate-500 text-[11px]">Bilateral distal toe numbness identified during consultation review of systems.</p>
            </div>

            {/* Proposal 3: Follow-up required */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Clock size={13} /> + Follow-up required
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check size={11} strokeWidth={3} /> Approved
                </span>
              </div>
              <p className="font-semibold text-slate-900">Repeat HbA1c & Renal Panel in 3 Months</p>
              <p className="text-slate-500 text-[11px]">Order dispatched to Quest Diagnostics prior to next scheduled appointment.</p>
            </div>
          </div>

          {/* Summary Confirmation */}
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between gap-2 text-emerald-900">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>3 longitudinal updates confirmed. Eleanor's story is updated for all future encounters.</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 shrink-0">
              FHIR Synced
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
