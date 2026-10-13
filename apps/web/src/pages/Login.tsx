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
    { num: '01', step: 'CAPTURE', title: 'Clinical Dialogue Capture', text: 'Live microphone recording or guided dialogue. Audio streams securely to backend with zero client API keys.', icon: Mic },
    { num: '02', step: 'DRAFT', title: 'Structured Note Synthesis', text: 'AI organizes dialogue into SOAP or General Consultation schemas under strict deterministic clinical prompts.', icon: FileText },
    { num: '03', step: 'VERIFY', title: 'Deterministic Safety Checks', text: 'Algorithmic rules check required sections, dosage patterns, potential allergy cross-reactivity, and duplicate orders.', icon: ShieldCheck },
    { num: '04', step: 'REVIEW', title: 'Physician Review & Editing', text: 'The physician reviews every suggestion. Every item is labeled — AI DRAFT, AI EXTRACTED, or PHYSICIAN EDITED.', icon: Brain },
    { num: '05', step: 'APPROVE', title: 'Explicit Doctor Sign-Off', text: 'Nothing is confirmed automatically. The physician acknowledges warnings and signs off explicitly before persistence.', icon: CheckCircle2 },
    { num: '06', step: 'REMEMBER', title: 'Longitudinal FHIR Memory', text: 'Approved clinical notes, prescriptions, and facts persist atomically to FHIR standards and become part of longitudinal patient memory.', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-blackgrain text-zinc-100 flex flex-col font-sans selection:bg-white selection:text-black antialiased overflow-x-hidden">
      
      {/* ── Top Telemetry Banner ── */}
      <div className="bg-zinc-950/80 border-b border-white/10 px-4 py-2 text-center text-[11px] font-mono text-zinc-400">
        <span className="px-2 py-0.5 rounded bg-white/10 text-white border border-white/15 mr-2 font-bold text-[9px] tracking-wider uppercase">
          CONTROLLED_EVALUATION
        </span>
        SYNTHETIC BETA ENVIRONMENT &bull; ZERO REAL PHI PERMITTED &bull; PHYSICIAN GOVERNANCE ACTIVE
      </div>

      {/* ── Header ── */}
      <header className="max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div 
          onClick={() => navigate('/welcome')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="h-8 w-8 rounded-lg bg-white text-black flex items-center justify-center group-hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <Activity size={17} className="stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base tracking-[0.16em] text-white">PROTON</span>
            <span className="text-[9px] font-mono tracking-widest text-zinc-400 px-2 py-0.5 rounded bg-white/[0.04] border border-white/10">
              [CLINICAL_OS]
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/welcome')}
            className="hidden sm:flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-mono px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            &lt; RETURN TO OVERVIEW
          </button>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white text-xs font-mono px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 hover:border-white/30 transition-all cursor-pointer"
          >
            <HelpCircle size={14} /> HOW IT WORKS
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col lg:flex-row items-center gap-14 justify-center">
        
        {/* ── Left: Product Presentation (Editorial Monospace Inspiration) ── */}
        <div className="flex-1 max-w-xl proton-animate-in">
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 text-[10px] font-mono tracking-widest uppercase">
            <Sparkles size={12} /> [ CLINICAL OS // PRACTICING PHYSICIANS ]
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-white tracking-tight leading-[1.12]">
            Your patient&apos;s story.<br />
            <span className="text-zinc-400 font-light">
              Understood before you walk in.
            </span>
          </h1>
          
          <p className="mt-5 text-sm sm:text-base text-zinc-400 leading-relaxed font-light max-w-lg">
            Proton provides ambient clinical documentation, deterministic safety verification, and longitudinal patient intelligence — keeping the physician as the absolute authority at every stage.
          </p>

          {/* Technical Pillars in Frosted Obsidian Cards */}
          <div className="mt-8 space-y-3 font-sans">
            {[
              { title: 'Ambient Clinical Documentation', desc: 'Consultation dialogue structured into SOAP schemas with transparent provenance.' },
              { title: 'Longitudinal FHIR Memory', desc: 'Past visits, lab drift trajectories, and prescriptions synthesized into continuous context.' },
              { title: 'Deterministic Safety Checks', desc: 'Hard-coded algorithms block cross-reactive allergy conflicts and invalid medication parameters.' },
              { title: 'Strict Physician Governance', desc: 'Zero autonomous prescribing. Every order requires explicit doctor sign-off.' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-zinc-950/70 border border-white/10 hover:border-white/25 transition-all">
                <div className="h-5 w-5 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={12} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-white">{item.title}</h4>
                  <p className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed font-light">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Synthetic Boundary Box */}
          <div className="mt-8 p-3.5 rounded-xl bg-zinc-950/90 border border-white/10 text-xs font-mono text-zinc-400 flex items-start gap-3">
            <Shield size={16} className="text-zinc-300 shrink-0 mt-0.5" />
            <div>
              <span className="text-zinc-200 font-bold uppercase tracking-wider">[ SYNTHETIC EVALUATION HARNESS ]:</span>{' '}
              Preloaded with realistic multi-encounter patient trajectories (Eleanor Vance, Arthur Pendelton) for physician evaluation.
            </div>
          </div>
        </div>

        {/* ── Right: Elevated Luxury Obsidian Login Card ── */}
        <div className="w-full max-w-[420px] shrink-0 proton-animate-in" style={{ animationDelay: '100ms' }}>
          <div className="p-8 sm:p-9 rounded-3xl bg-zinc-950/85 border border-white/10 backdrop-blur-xl shadow-2xl relative">
            
            {/* Top Card Monospace Tag */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono text-zinc-400 font-bold tracking-widest uppercase">[ PORTAL // AUTH ]</span>
                <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                  Physician Sign-In
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/20 tracking-wider">
                ACTIVE
              </span>
            </div>

            {error && (
              <div className="mb-6 bg-zinc-900 border border-white/20 p-3 rounded-xl text-xs text-zinc-200 flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-zinc-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4 font-sans" onSubmit={handleLogin}>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 pl-0.5">
                  Physician Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@proton.local"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/70 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5 pl-0.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/70 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="luxury-pill-white w-full py-3 justify-center text-sm font-semibold cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Physician Workspace</span>
                      <ArrowRight size={15} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Fill One-Click Access */}
            <div className="mt-7 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-zinc-400 mb-3 font-sans">Evaluating Proton for the first time?</p>
              <button
                type="button"
                onClick={handleQuickFillSyntheticDoctor}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-zinc-300 flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-zinc-300" />
                  <span>Use Synthetic Evaluation Account</span>
                </div>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform text-zinc-500" />
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-7xl w-full mx-auto px-6 py-5 text-center text-[11px] font-mono text-zinc-500 border-t border-white/10">
        <p>PROTON CLINICAL OS &bull; SYNTHETIC EVALUATION ENVIRONMENT &bull; FHIR R4 BACKED</p>
      </footer>

      {/* ── How Proton Works Modal ── */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 proton-animate-in">
          <div className="bg-zinc-950 rounded-3xl max-w-2xl w-full p-7 border border-white/15 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-white text-black rounded-lg flex items-center justify-center">
                  <Activity size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">[ ARCHITECTURE_BRIEF ]</div>
                  <h3 className="text-base font-bold text-white">How Proton Works</h3>
                </div>
              </div>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {workflowSteps.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/10 flex items-start gap-3.5">
                    <div className="h-7 w-7 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-400 font-bold">{s.num} // {s.step}</span>
                        <h4 className="text-xs font-semibold text-white">{s.title}</h4>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-light">{s.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowHowItWorks(false)}
                className="luxury-pill-white text-xs py-2 px-5 cursor-pointer"
              >
                Close Brief
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
