import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Users,
  FileText,
  Mic,
  ShieldCheck,
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
  Stethoscope
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

  const isDarkMode = false;

  return (
    <div 
      className={`proton-onboarding fixed inset-0 z-50 flex flex-col overflow-y-auto transition-colors duration-500 ${
        isDarkMode 
          ? 'bg-solid text-on-solid proton-grid-pattern' 
          : 'bg-paper-2/95 text-ink'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Proton Onboarding Tour"
    >
      {/* ── TOP HEADER / STEP INDICATOR BAR ── */}
      <header 
        className={`sticky top-0 z-20 px-4 sm:px-8 py-4 transition-colors duration-300 border-b ${
          isDarkMode 
            ? 'bg-solid/90 border-rule-strong/80' 
            : 'bg-paper/90 border-rule/80 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Clinical Badge */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-paper-2 text-ink flex items-center justify-center">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-bold tracking-tight text-base ${isDarkMode ? 'text-white' : 'text-ink'}`}>
                  PROTON
                </span>
                <span className="proton-micro-label px-1.5 py-0.5 rounded bg-paper-2 text-ink-2 border border-rule">
                  <span className="hidden sm:inline">Workspace guide</span>
                  <span className="sm:hidden">Guide</span>
                </span>
              </div>
              <p className={`text-[11px] font-medium hidden sm:block ${isDarkMode ? 'text-ink-3' : 'text-on-solid0'}`}>
                Physician-led clinical support
              </p>
            </div>
          </div>

          {/* Stepper with connecting lines */}
          <div className="order-last flex w-full flex-col items-center sm:order-none sm:w-auto">
            <span className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-ink-3' : 'text-on-solid0'}`}>
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
                            ? 'bg-settled text-white hover:bg-settled'
                            : isDarkMode
                              ? 'bg-solid border border-rule-strong text-on-solid0 hover:text-ink-3'
                              : 'bg-paper-2 border border-rule text-ink-3 hover:text-ink-2'
                      }`}
                    >
                      {isCompleted ? <Check size={13} strokeWidth={3} /> : s}
                    </button>

                    {/* Connecting Line */}
                    {index < TOTAL_STEPS - 1 && (
                      <div
                        className={`h-[2px] w-4 sm:w-8 md:w-12 transition-colors duration-300 ${
                          s < currentStep
                            ? 'bg-settled'
                            : isDarkMode
                              ? 'bg-solid'
                              : 'bg-rule'
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
                  ? 'text-ink-3 hover:text-white hover:bg-solid' 
                  : 'text-on-solid0 hover:text-ink hover:bg-paper-2'
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
            ? 'bg-solid/80 border-slate-850 text-on-solid0' 
            : 'bg-paper/80 border-rule text-on-solid0'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Proton Clinical Platform</span>
            <span>&bull;</span>
            <span>Synthetic Evaluation Environment</span>
            <span>&bull;</span>
            <span className="text-caution-on-solid0 font-medium">Physician Approval Gated</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Use <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${isDarkMode ? 'bg-solid border-rule-strong text-ink-3' : 'bg-paper-2 border-rule text-ink-2'}`}>&larr;</kbd> <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${isDarkMode ? 'bg-solid border-rule-strong text-ink-3' : 'bg-paper-2 border-rule text-ink-2'}`}>&rarr;</kbd> to navigate</span>
            <span>&bull;</span>
            <span>Press <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${isDarkMode ? 'bg-solid border-rule-strong text-ink-3' : 'bg-paper-2 border-rule text-ink-2'}`}>Esc</kbd> to exit</span>
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
        <div className="space-y-2">
          <div className="h-12 w-12 rounded-xl bg-paper-2 text-ink flex items-center justify-center mb-4">
            <Activity size={36} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
            Welcome to Proton
          </h1>
          <p className="text-xl sm:text-2xl font-medium text-brand-300">
            Clearer context for care.
          </p>
        </div>

        <p className="text-ink-3 text-base leading-relaxed">
          Proton helps you understand patient context, document consultations, review clinical information, and build a longitudinal patient story.
        </p>

        <div className="space-y-3 border-l border-rule pl-4">
          <div>
              <p className="text-sm font-semibold text-ink">Physician review</p>
              <p className="text-xs text-ink-3">Every note and order requires your review before it is saved.</p>
          </div>
          <div>
              <p className="text-sm font-semibold text-ink">Patient history</p>
              <p className="text-xs text-ink-3">Approved findings build the ongoing patient story across future appointments.</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={onNext}
            className="proton-btn proton-btn-primary px-6 py-3.5 text-sm rounded-lg font-semibold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Show me around</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={onSkip}
            className="proton-btn proton-btn-ghost text-ink-3 hover:text-white text-sm font-semibold cursor-pointer"
          >
            Skip tutorial
          </button>
        </div>
      </div>

      {/* Sample patient record */}
      <div className="lg:col-span-7">
        <div className="rounded-xl border border-rule bg-paper">
          <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-solid0">Sample patient</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">Eleanor Vance</h2>
            </div>
            <span className="shrink-0 rounded-md border border-rule px-2 py-1 text-[10px] font-medium text-ink-2">
              Synthetic record
            </span>
          </div>
          <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-5">
              <p className="text-xs font-medium text-on-solid0">Conditions</p>
              <p className="mt-2 text-sm font-medium text-ink">Type 2 diabetes</p>
              <p className="mt-1 text-sm text-ink-2">Essential hypertension</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-medium text-on-solid0">Allergy</p>
              <p className="mt-2 text-sm font-medium text-ink">Penicillin</p>
              <p className="mt-1 text-sm text-ink-2">Review before prescribing</p>
            </div>
          </div>
          <div className="border-t border-rule px-5 py-3 text-xs text-ink-2">
            Notes and orders are saved only after physician review.
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
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Your Command Center
          </h2>
          <p className="text-base sm:text-lg font-medium text-ink-2 mt-2">
            This is where Proton tells you what needs your attention today.
          </p>
        </div>

        <p className="text-ink-2 text-sm leading-relaxed">
          Start every clinic shift with clarity. Rather than navigating disconnected inboxes and EMR queues, Proton brings together pending safety flags, unfinalized consult drafts, and incoming documents into a single prioritized workspace.
        </p>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="proton-badge bg-critical-wash text-critical border border-critical-line py-1 px-2.5">
            <AlertTriangle size={12} className="text-critical" />
            Safety Alert Triage
          </span>
          <span className="proton-badge bg-caution-wash text-caution border border-caution-line py-1 px-2.5">
            <Clock size={12} className="text-caution" />
            Unfinished Draft Queue
          </span>
          <span className="proton-badge bg-accent-wash text-accent-ink border border-accent-line py-1 px-2.5">
            <FileText size={12} className="text-accent-ink" />
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
        <div className="proton-card p-5 sm:p-6 bg-paper border border-rule shadow-md space-y-5">
          {/* Dashboard Header Bar */}
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink tracking-tight">Today's Clinic Dashboard</h3>
              <p className="text-[11px] text-on-solid0">Dr. Eleanor Vance, MD &bull; General Internal Medicine</p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-settled-wash text-settled border border-settled-line">
              ● All Systems Live
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-paper-2 border border-rule">
              <div className="flex items-center justify-between text-on-solid0 mb-1">
                <span className="text-[11px] font-semibold uppercase">Patients</span>
                <Users size={14} className="text-brand-600" />
              </div>
              <p className="text-xl font-extrabold text-ink">24</p>
              <p className="text-[10px] text-on-solid0">4 with pending labs</p>
            </div>

            <div className="p-3 rounded-xl bg-paper-2 border border-rule">
              <div className="flex items-center justify-between text-on-solid0 mb-1">
                <span className="text-[11px] font-semibold uppercase">Consultations</span>
                <Mic size={14} className="text-accent-ink" />
              </div>
              <p className="text-xl font-extrabold text-ink">8</p>
              <p className="text-[10px] text-on-solid0">2 pending signature</p>
            </div>

            <div className="p-3 rounded-xl bg-paper-2 border border-rule">
              <div className="flex items-center justify-between text-on-solid0 mb-1">
                <span className="text-[11px] font-semibold uppercase">Documents</span>
                <FileText size={14} className="text-caution" />
              </div>
              <p className="text-xl font-extrabold text-ink">3</p>
              <p className="text-[10px] text-on-solid0">1 urgent pathology</p>
            </div>
          </div>

          {/* Needs Your Attention Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wide">
                <AlertTriangle size={14} className="text-caution" />
                <span>Needs Your Attention</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-caution-wash text-caution">
                3 Pending
              </span>
            </div>

            {/* Item 1: Safety Alert */}
            <div className="p-3 rounded-xl bg-critical-wash/50 border border-critical-line flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-critical-wash text-critical shrink-0 mt-0.5">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-critical">Safety Alert &bull; Allergy Conflict</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-critical-line/60 text-critical">Critical</span>
                  </div>
                  <p className="text-[11px] text-critical font-medium">Eleanor Vance (42y)</p>
                  <p className="text-[11px] text-ink-2">Amoxicillin draft contraindicated by documented Penicillin anaphylaxis.</p>
                </div>
              </div>
              <button className="px-2.5 py-1 rounded-lg text-xs font-bold bg-paper text-critical border border-critical-line hover:bg-critical-wash shrink-0 inline-flex items-center gap-1">
                <span>Review</span>
                <ChevronRight size={12} />
              </button>
            </div>

            {/* Item 2: Unfinished Draft */}
            <div className="p-3 rounded-xl bg-caution-wash/50 border border-caution-line flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-caution-wash text-caution shrink-0 mt-0.5">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-caution">Unfinished Consultation Draft</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-caution-line/60 text-caution">Today 09:15</span>
                  </div>
                  <p className="text-[11px] text-caution font-medium">Marcus Chen (58y)</p>
                  <p className="text-[11px] text-ink-2">Cardiology follow-up audio captured &bull; SOAP draft awaiting physician sign.</p>
                </div>
              </div>
              <button className="px-2.5 py-1 rounded-lg text-xs font-bold bg-paper text-caution border border-caution-line hover:bg-caution-wash shrink-0 inline-flex items-center gap-1">
                <span>Resume</span>
                <ChevronRight size={12} />
              </button>
            </div>

            {/* Item 3: Document to Review */}
            <div className="p-3 rounded-xl bg-accent-wash/50 border border-accent-line flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-accent-wash text-accent-ink shrink-0 mt-0.5">
                  <FileText size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-accent-ink">Document to Review</span>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-accent-line/60 text-accent-ink">Biopsy PDF</span>
                  </div>
                  <p className="text-[11px] text-accent-ink font-medium">Sarah Jenkins (36y)</p>
                  <p className="text-[11px] text-ink-2">External surgical pathology report &bull; 4 clinical findings extracted.</p>
                </div>
              </div>
              <button className="px-2.5 py-1 rounded-lg text-xs font-bold bg-paper text-accent-ink border border-accent-line hover:bg-accent-wash shrink-0 inline-flex items-center gap-1">
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
          <span>Step 3 &bull; Patient summary</span>
        </div>

        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Patient summary
          </h2>
          <p className="text-base sm:text-lg font-medium text-ink-2 mt-2">
            Before you see the patient, Proton summarizes what matters.
          </p>
        </div>

        <p className="text-ink-2 text-sm leading-relaxed">
          Review recent changes, allergy alerts, and the patient's history in one concise view.
        </p>

        {/* Highlight bullets */}
        <div className="space-y-2 pt-1 text-xs text-ink-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
            <span><strong>What Matters Today:</strong> Dynamic delta tracking between past and current visits</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
            <span><strong>Objective Lab Trajectory:</strong> Automatic detection of out-of-range clinical shifts</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
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
        <div className="proton-card p-5 sm:p-6 bg-paper border border-rule shadow-md space-y-4">
          {/* Patient Header */}
          <div className="flex items-start justify-between border-b border-rule pb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-accent to-accent text-white flex items-center justify-center font-bold text-base shadow-sm">
                EV
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-ink">Eleanor Vance</h3>
                  <span className="text-xs text-on-solid0 font-medium">42y &bull; Female</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-paper-2 text-ink-2">
                    MRN: #94821
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-accent-wash text-accent-ink border border-accent-line">
                    Type 2 Diabetes
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-paper-2 text-ink-2">
                    Hypertension
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 flex items-center gap-1">
              <CheckCircle2 size={11} /> Briefing Ready
            </span>
          </div>

          {/* What Matters Today Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={13} className="text-brand-600" />
                What Matters Today
              </span>
              <span className="text-[10px] text-on-solid0">Updated 2m ago</span>
            </div>

            {/* Allergies Item */}
            <div className="p-2.5 rounded-xl bg-critical-wash/70 border border-critical-line flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-critical-wash text-critical shrink-0 mt-0.5">
                <AlertTriangle size={14} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-critical">Allergy Warning: Penicillin</span>
                <p className="text-ink-2 mt-0.5">Documented severe anaphylaxis. Strict beta-lactam avoidance required.</p>
              </div>
            </div>

            {/* Lab Changes Item */}
            <div className="p-2.5 rounded-xl bg-caution-wash/70 border border-caution-line flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-caution-wash text-caution shrink-0 mt-0.5">
                <TrendingUp size={14} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-caution">Lab Shift: HbA1c 7.1% &rarr; 8.4%</span>
                <p className="text-ink-2 mt-0.5">Elevated HbA1c from Quest Diagnostics 5 days ago indicates worsening glycemic control.</p>
              </div>
            </div>

            {/* Medication Changes Item */}
            <div className="p-2.5 rounded-xl bg-accent-wash/70 border border-accent-line flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-accent-wash text-accent-ink shrink-0 mt-0.5">
                <Pill size={14} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-accent-ink">Medication Change: Lisinopril 20mg</span>
                <p className="text-ink-2 mt-0.5">Titrated up by Nephrology 3 weeks ago. Recent BP averaging 124/80 mmHg.</p>
              </div>
            </div>
          </div>

          {/* Clinical Timeline Preview */}
          <div className="pt-2 border-t border-rule">
            <span className="text-[11px] font-bold text-ink-2 uppercase tracking-wide block mb-2">
              Clinical Timeline
            </span>
            <div className="relative pl-4 space-y-2 border-l-2 border-rule text-xs text-ink-2">
              <div className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white"></span>
                <span className="font-semibold text-ink">Today:</span> Follow-up Consultation &bull; Diabetes & HTN Review
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-ink-3 ring-2 ring-white"></span>
                <span className="font-medium text-ink-2">5 days ago:</span> Outpatient Lab &bull; HbA1c 8.4%, eGFR &gt; 60
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-ink-3 ring-2 ring-white"></span>
                <span className="font-medium text-ink-2">3 weeks ago:</span> Nephrology Visit &bull; Lisinopril dose increase
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
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Clinical Consultation
          </h2>
          <p className="text-base sm:text-lg font-medium text-ink-2 mt-2">
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
            Proton uses AI to prepare an editable draft. It never writes directly to the chart; you review and approve it.
          </p>
        </div>

        {/* Workflow stages */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-on-solid0 uppercase tracking-wider">Consultation Workflow</span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-paper border border-rule">
              <span className="font-bold text-ink block">1. Record</span>
              <span className="text-[10px] text-on-solid0">Ambient audio</span>
            </div>
            <div className="p-2.5 rounded-xl bg-paper border border-rule">
              <span className="font-bold text-ink block">2. Transcript</span>
              <span className="text-[10px] text-on-solid0">Speaker separated</span>
            </div>
            <div className="p-2.5 rounded-xl bg-paper border border-brand-200 bg-brand-50/30">
              <span className="font-bold text-brand-700 block">3. Clinical draft</span>
              <span className="text-[10px] text-brand-600">Structured SOAP</span>
            </div>
          </div>
        </div>

        {/* Provenance Badges Explainer */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-on-solid0 uppercase tracking-wider">Provenance Badges</span>
          <div className="flex flex-wrap gap-2">
            <span className="proton-badge bg-accent-wash text-accent-ink border border-accent-line">
              <FileText size={11} className="text-accent-ink" /> AI-GENERATED DRAFT
            </span>
            <span className="proton-badge bg-accent-wash text-accent-ink border border-accent-line">
              PHYSICIAN EDITED
            </span>
            <span className="proton-badge bg-settled-wash text-settled border border-settled-line">
              <ShieldCheck size={11} className="text-settled" /> PHYSICIAN APPROVED
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
        <div className="proton-card p-5 sm:p-6 bg-paper border border-rule shadow-md space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-rule bg-paper-2 p-3">
            <div>
              <span className="text-xs font-semibold text-ink">Sample consultation transcript</span>
              <p className="mt-0.5 text-[10px] text-ink-2">Synthetic example for review</p>
            </div>
            <FileText size={16} className="shrink-0 text-on-solid0" />
          </div>

          {/* Transcript Snippet */}
          <div className="p-3 rounded-xl bg-paper-2 border border-rule text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-on-solid0 uppercase">
              <span>Conversation</span>
            </div>
            <div className="space-y-1.5 text-ink-2">
              <p>
                <strong className="text-ink font-semibold">Dr. Vance:</strong> "Good morning Eleanor. Your recent HbA1c is 8.4%. Any side effects on the Lisinopril?"
              </p>
              <p>
                <strong className="text-ink font-semibold">Eleanor:</strong> "No dizziness, but I've had some tingling in my toes lately."
              </p>
              <p>
                <strong className="text-ink font-semibold">Dr. Vance:</strong> "Let's increase Metformin to 1000mg twice daily with meals and evaluate the numbness."
              </p>
            </div>
          </div>

          {/* Structured Note Draft Preview */}
          <div className="p-3.5 rounded-xl bg-paper border border-rule space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wide">
                Clinical note draft
              </span>
              <span className="proton-badge bg-accent-wash text-accent-ink border border-accent-line">
                <FileText size={11} className="text-accent-ink" /> AI-GENERATED DRAFT
              </span>
            </div>

            {/* Assessment */}
            <div className="text-xs space-y-1 border-l-2 border-accent pl-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">Assessment:</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent-wash text-accent-ink font-semibold">AI-generated</span>
              </div>
              <p className="text-ink-2">
                1. Type 2 Diabetes Mellitus with worsening glycemic control (recent HbA1c 8.4%).
                <br />
                2. Early bilateral peripheral neuropathy (subtle distal paresthesia).
              </p>
            </div>

            {/* Plan */}
            <div className="text-xs space-y-1 border-l-2 border-accent pl-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">Plan:</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent-wash text-accent-ink font-semibold">PHYSICIAN EDITED</span>
              </div>
              <p className="text-ink-2">
                Titrate Metformin from 500mg BID to 1000mg PO BID with meals. Recheck HbA1c in 90 days. Recommend diabetic foot exam.
              </p>
            </div>

            {/* Objective Vitals */}
            <div className="text-xs space-y-1 border-l-2 border-settled pl-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">Objective Vitals:</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-settled-wash text-settled font-semibold">PHYSICIAN APPROVED</span>
              </div>
              <p className="text-ink-2">
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
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Verify & Approve
          </h2>
          <p className="text-lg sm:text-xl font-bold text-brand-700 mt-2">
            Every draft is reviewed before it becomes part of the record.
          </p>
        </div>

        <p className="text-ink-2 text-sm leading-relaxed">
          AI-generated content can be wrong. Before any clinical draft is signed, deterministic safety rules check for drug-allergy conflicts, dosage parameters, and missing fields.
        </p>

        {/* Safety Principles */}
        <div className="space-y-2 text-xs text-ink-2 pt-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
            <span><strong>Deterministic rule engine:</strong> Safe execution rules, not probabilistic guesses</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
            <span><strong>Hard conflict blocking:</strong> Prevents contraindicated medications from being signed</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
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
        <div className="proton-card p-5 sm:p-6 bg-paper border border-rule shadow-md space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-600" />
              <div>
                <h3 className="text-sm font-bold text-ink">Clinical Safety & Verification</h3>
                <p className="text-[11px] text-on-solid0">Deterministic checks evaluated before EHR persistence</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-caution-wash text-caution">
              1 Conflict Flagged
            </span>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-2.5">
            {/* Check 1 */}
            <div className="p-3 rounded-xl bg-settled-wash/50 border border-settled-line flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-settled-wash text-settled shrink-0 mt-0.5">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-settled">Required fields present</span>
                <p className="text-ink-2 mt-0.5">Subjective, Objective, Assessment, and Plan all properly structured with clinical detail.</p>
              </div>
              <span className="text-[10px] font-bold text-settled bg-settled-wash px-2 py-0.5 rounded ml-auto shrink-0">
                Passed
              </span>
            </div>

            {/* Check 2: Conflict */}
            <div className="p-3 rounded-xl bg-caution-wash/80 border border-caution-line flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-caution-wash text-caution shrink-0 mt-0.5">
                <AlertTriangle size={14} />
              </div>
              <div className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-caution">Allergy conflict detected</span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-caution-line text-caution">
                    Action Blocked
                  </span>
                </div>
                <p className="text-ink-2 mt-0.5">
                  Suggested Amoxicillin draft blocked by documented Penicillin Anaphylaxis. Replaced with Azithromycin 250mg.
                </p>
              </div>
              <span className="text-[10px] font-bold text-caution bg-caution-wash px-2 py-0.5 rounded ml-auto shrink-0">
                Resolved
              </span>
            </div>

            {/* Check 3 */}
            <div className="p-3 rounded-xl bg-settled-wash/50 border border-settled-line flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-settled-wash text-settled shrink-0 mt-0.5">
                <Check size={14} strokeWidth={3} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-settled">No duplicate medication</span>
                <p className="text-ink-2 mt-0.5">Metformin 1000mg correctly supersedes previous 500mg dose without duplicate order.</p>
              </div>
              <span className="text-[10px] font-bold text-settled bg-settled-wash px-2 py-0.5 rounded ml-auto shrink-0">
                Passed
              </span>
            </div>
          </div>

          {/* Physician Sign-Off Action Mockup */}
          <div className="pt-3 border-t border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper-2 p-3 rounded-xl">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-ink">Physician Approval Gate</span>
                <span className="proton-badge bg-settled-wash text-settled border border-settled-line text-[10px]">
                  Ready to Sign
                </span>
              </div>
              <p className="text-[11px] text-on-solid0">Dr. Eleanor Vance, MD &bull; NPI #1982736410</p>
            </div>

            <button className="px-4 py-2 rounded-xl bg-settled hover:bg-solid text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
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
          <FileText size={13} className="text-brand-600" />
          <span>Step 6 &bull; Longitudinal Patient Memory</span>
        </div>

        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Longitudinal Memory
          </h2>
          <p className="text-lg sm:text-xl font-bold text-brand-700 mt-2">
            Approved information becomes part of the patient's story.
          </p>
        </div>

        <p className="text-ink-2 text-sm leading-relaxed">
          Proton saves only the changes you approve. At the end of a consultation, proposed updates are shown for review before they are added to the patient record.
        </p>

        {/* Value Callouts */}
        <div className="space-y-2 text-xs text-ink-2 pt-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
            <span><strong>Zero chart amnesia:</strong> Medication changes and symptoms follow the patient</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
            <span><strong>Physician gate required:</strong> Memory proposals require doctor acceptance</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-settled shrink-0" />
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
              className="text-xs font-semibold text-on-solid0 hover:text-ink flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Step 5</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Visual Mockup Column */}
      <div className="lg:col-span-7">
        <div className="proton-card p-5 sm:p-6 bg-paper border border-rule shadow-md space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-rule pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink tracking-tight">
                  PATIENT MEMORY UPDATE PROPOSALS
                </h3>
                <p className="text-[11px] text-on-solid0">Proposed longitudinal changes from Eleanor Vance visit</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              Physician Gated
            </span>
          </div>

          {/* Memory Proposal Items */}
          <div className="space-y-2.5">
            {/* Proposal 1: Medication changed */}
            <div className="p-3 rounded-xl bg-paper-2 border border-rule space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-accent-ink flex items-center gap-1">
                  <Pill size={13} /> + Medication changed
                </span>
                <span className="text-[10px] font-bold text-settled bg-settled-wash px-2 py-0.5 rounded flex items-center gap-1">
                  <Check size={11} strokeWidth={3} /> Approved
                </span>
              </div>
              <p className="font-semibold text-ink">Metformin titrated to 1000mg BID</p>
              <p className="text-on-solid0 text-[11px]">Supersedes previous 500mg BID dose due to recent elevated HbA1c (8.4%).</p>
            </div>

            {/* Proposal 2: New clinical finding */}
            <div className="p-3 rounded-xl bg-paper-2 border border-rule space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-accent-ink flex items-center gap-1">
                  <Stethoscope size={13} /> + New clinical finding
                </span>
                <span className="text-[10px] font-bold text-settled bg-settled-wash px-2 py-0.5 rounded flex items-center gap-1">
                  <Check size={11} strokeWidth={3} /> Approved
                </span>
              </div>
              <p className="font-semibold text-ink">Early diabetic peripheral neuropathy</p>
              <p className="text-on-solid0 text-[11px]">Bilateral distal toe numbness identified during consultation review of systems.</p>
            </div>

            {/* Proposal 3: Follow-up required */}
            <div className="p-3 rounded-xl bg-paper-2 border border-rule space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-settled flex items-center gap-1">
                  <Clock size={13} /> + Follow-up required
                </span>
                <span className="text-[10px] font-bold text-settled bg-settled-wash px-2 py-0.5 rounded flex items-center gap-1">
                  <Check size={11} strokeWidth={3} /> Approved
                </span>
              </div>
              <p className="font-semibold text-ink">Repeat HbA1c & Renal Panel in 3 Months</p>
              <p className="text-on-solid0 text-[11px]">Order dispatched to Quest Diagnostics prior to next scheduled appointment.</p>
            </div>
          </div>

          {/* Summary Confirmation */}
          <div className="p-3 rounded-xl bg-settled-wash border border-settled-line text-xs flex items-center justify-between gap-2 text-settled">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-settled shrink-0" />
              <span>3 longitudinal updates confirmed. Eleanor's story is updated for all future encounters.</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-settled shrink-0">
              FHIR Synced
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
