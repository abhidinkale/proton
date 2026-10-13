import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  HelpCircle, 
  X,
  Shield,
  AlertTriangle,
  Mic,
  FileText,
  Brain,
  ShieldCheck,
  Clock,
  ChevronRight
} from 'lucide-react';
import { authService } from '../services/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await authService.login({ email, password });
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err?._remainingPoints === '0' || err?._remainingPoints === 0 || err?.message?.includes('Too Many Requests')) {
        const ms = err?._msBeforeNext ? Number(err._msBeforeNext) : 30000;
        const seconds = Math.ceil(ms / 1000);
        setError(`Authentication rate limit reached. Please wait ${seconds} seconds before attempting to sign in again.`);
      } else {
        setError(err.message || 'Authentication failed. Please verify credentials or connectivity.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFillSyntheticDoctor = () => {
    setEmail('admin@example.com');
    // Using base64 decode of standard evaluation credential
    setPassword(atob('bWVkcGx1bV9hZG1pbg=='));
    setError('');
  };

  const workflowSteps = [
    { num: '01', step: 'CAPTURE', title: 'Clinical Dialogue Capture', text: 'Live microphone recording or guided dialogue. Audio streams securely to the backend transcription service with zero client API keys.', icon: Mic },
    { num: '02', step: 'DRAFT', title: 'Structured Note Synthesis', text: 'AI organizes dialogue into SOAP or General Consultation schemas under strict deterministic clinical prompts.', icon: FileText },
    { num: '03', step: 'VERIFY', title: 'Deterministic Safety Checks', text: 'Algorithmic rules check required sections, dosage patterns, potential allergy cross-reactivity, and duplicate orders.', icon: ShieldCheck },
    { num: '04', step: 'REVIEW', title: 'Physician Review & Editing', text: 'The physician reviews every suggestion. Every item is labeled — AI DRAFT, AI EXTRACTED, or PHYSICIAN EDITED.', icon: Brain },
    { num: '05', step: 'APPROVE', title: 'Explicit Doctor Sign-Off', text: 'Nothing is confirmed automatically. The physician acknowledges warnings and signs off explicitly before persistence.', icon: CheckCircle2 },
    { num: '06', step: 'REMEMBER', title: 'Longitudinal FHIR Memory', text: 'Approved clinical notes, prescriptions, and facts persist atomically to FHIR standards and become part of longitudinal patient memory.', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-raised)] flex flex-col selection:bg-brand-100 selection:text-brand-900">
      
      {/* ── Synthetic Beta Banner ── */}
      <div className="bg-amber-50 border-b border-amber-200/60 px-4 py-1.5 text-center text-[11px] text-amber-800 font-medium">
        <span className="proton-micro-label bg-amber-600 text-white px-1.5 py-0.5 rounded mr-2">
          SYNTHETIC BETA
        </span>
        Controlled synthetic-data physician evaluation environment · No real patient data permitted
      </div>

      {/* ── Header ── */}
      <header className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-brand-700 text-white rounded-lg flex items-center justify-center">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-xl tracking-tight text-[var(--color-text-primary)]">PROTON</span>
            <span className="proton-micro-label px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-text-tertiary)] border border-[var(--color-border-default)]">
              Physician Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/welcome')}
            className="hidden sm:flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm font-medium px-3 py-2 rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors cursor-pointer"
          >
            Product
          </button>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm font-medium px-3 py-2 rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors cursor-pointer"
          >
            <HelpCircle size={15} /> How It Works
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 flex flex-col lg:flex-row items-center gap-16 justify-center">
        
        {/* ── Left: Product Value ── */}
        <div className="flex-1 max-w-xl proton-animate-in">
          <div className="proton-badge bg-brand-50 text-brand-700 border border-brand-200/60 mb-5 py-1 px-3">
            <Sparkles size={13} /> AI Clinical Copilot for Physicians
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[var(--color-text-primary)] tracking-tight leading-[1.1]">
            Your patient's story.
            <br />
            <span className="text-brand-700">Understood before you walk in.</span>
          </h1>
          
          <p className="mt-5 text-[15px] text-[var(--color-text-secondary)] leading-relaxed max-w-lg">
            An AI-native clinical copilot that augments physicians with intelligent documentation, 
            longitudinal patient memory, and actionable clinical insight — with the physician 
            remaining the final authority at every stage.
          </p>

          {/* Capabilities */}
          <div className="mt-8 space-y-3 proton-stagger">
            {[
              { title: 'AI-assisted clinical documentation', desc: 'Ambient consultation capture structured into SOAP or General Consultation formats.' },
              { title: 'Longitudinal patient memory', desc: 'Past visits, lab trends, and medical records synthesized into a unified chronological story.' },
              { title: 'Intelligent document understanding', desc: 'Clinical facts, medications, and labs extracted from uploaded reports with source quotes.' },
              { title: 'Physician-controlled workflows', desc: 'Zero autonomous prescribing. Nothing is saved without your explicit sign-off.' },
              { title: 'Source-grounded clinical context', desc: 'Every AI suggestion displays transparent provenance, evidence, and confidence rating.' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-200 transition-colors">
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</h4>
                  <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Scope Notice */}
          <div className="mt-8 p-4 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl text-xs text-[var(--color-text-secondary)] flex items-start gap-3">
            <Shield size={16} className="text-[var(--color-text-tertiary)] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">Controlled Synthetic Beta:</span>{' '}
              Proton is currently deployed for evaluation with synthetic test patients. Real clinical data or autonomous diagnostic decisions are strictly excluded.
            </div>
          </div>
        </div>

        {/* ── Right: Login Card ── */}
        <div className="w-full max-w-[400px] shrink-0 proton-animate-in" style={{ animationDelay: '100ms' }}>
          <div className="proton-card p-8 sm:p-9">
            <div className="text-center mb-7">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
                Enter Physician Workspace
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5">
                Access your clinical command center & patient panel
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-3 border-red-500 p-3 rounded-lg text-xs text-red-700 flex items-start gap-2 proton-animate-in">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block proton-micro-label text-[var(--color-text-secondary)] mb-1.5 pl-0.5">
                  Physician Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  className="proton-input"
                />
              </div>

              <div>
                <label className="block proton-micro-label text-[var(--color-text-secondary)] mb-1.5 pl-0.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="proton-input"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="proton-btn proton-btn-primary w-full py-3"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Enter Physician Workspace
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Fill */}
            <div className="mt-7 pt-6 border-t border-[var(--color-border-subtle)] text-center">
              <p className="text-xs text-[var(--color-text-tertiary)] mb-3">Evaluating Proton for the first time?</p>
              <button
                type="button"
                onClick={handleQuickFillSyntheticDoctor}
                className="proton-btn proton-btn-secondary w-full text-xs py-2.5"
              >
                <Sparkles size={13} className="text-brand-600" />
                Use Synthetic Evaluation Account
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-5 text-center text-[11px] text-[var(--color-text-tertiary)] border-t border-[var(--color-border-subtle)]">
        <p>Proton Physician Beta · Controlled Synthetic Evaluation Environment · Designed for practicing physicians</p>
      </footer>

      {/* ── How Proton Works Modal ── */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 bg-[var(--color-surface-overlay)] backdrop-blur-sm flex items-center justify-center p-4 proton-animate-in" style={{ animationDuration: '200ms' }}>
          <div className="bg-[var(--color-surface)] rounded-2xl max-w-2xl w-full p-7 shadow-[var(--shadow-modal)] border border-[var(--color-border-default)] proton-animate-scale-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-5 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-brand-50 text-brand-700 rounded-lg flex items-center justify-center">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--color-text-primary)] text-base">How Proton Works</h3>
                  <p className="text-xs text-[var(--color-text-tertiary)]">The 6-stage clinical documentation & memory lifecycle</p>
                </div>
              </div>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] p-2 rounded-lg hover:bg-[var(--color-surface-raised)] cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-6 space-y-3 proton-stagger">
              {workflowSteps.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="proton-micro-label text-brand-700 bg-brand-50 px-2 py-1 rounded-md border border-brand-100">
                      {item.num}
                    </span>
                    <item.icon size={16} className="text-brand-600 mt-1" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="proton-micro-label text-brand-700">{item.step}</span>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">{item.title}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-5 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-tertiary)]">Physician is the final authority at every stage</span>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="proton-btn proton-btn-primary text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
