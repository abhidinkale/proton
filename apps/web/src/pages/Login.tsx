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
    <div className="min-h-screen bg-[#05070f] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 antialiased overflow-x-hidden proton-hud-grid">
      
      {/* ── Top Telemetry Banner ── */}
      <div className="bg-cyan-950/40 border-b border-cyan-500/20 px-4 py-1.5 text-center text-[11px] font-mono text-cyan-300">
        <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mr-2">
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
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:border-cyan-400 transition-colors shadow-[0_0_15px_rgba(56,189,248,0.2)]">
            <Activity size={17} className="stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-wider text-white">PROTON</span>
            <span className="text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20">
              [CLINICAL_OS]
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/welcome')}
            className="hidden sm:flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-mono px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            &lt; RETURN TO OVERVIEW
          </button>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-1.5 text-slate-300 hover:text-cyan-400 text-xs font-mono px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer"
          >
            <HelpCircle size={14} /> HOW IT WORKS
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col lg:flex-row items-center gap-14 justify-center">
        
        {/* ── Left: Product Presentation (HUD Inspiration) ── */}
        <div className="flex-1 max-w-xl proton-animate-in">
          <div className="proton-hud-tag mb-4 px-2.5 py-1 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-300">
            <Sparkles size={12} /> CLINICAL OS FOR PRACTICING PHYSICIANS
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.12]">
            Your patient&apos;s story.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-indigo-300">
              Understood before you walk in.
            </span>
          </h1>
          
          <p className="mt-5 text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-lg">
            Proton provides ambient clinical documentation, deterministic safety verification, and longitudinal patient intelligence — keeping the physician as the absolute authority at every stage.
          </p>

          {/* Technical Pillars */}
          <div className="mt-8 space-y-3 font-sans">
            {[
              { title: 'Ambient Clinical Documentation', desc: 'Consultation dialogue structured into SOAP schemas with transparent provenance.' },
              { title: 'Longitudinal FHIR Memory', desc: 'Past visits, lab drift trajectories, and prescriptions synthesized into continuous context.' },
              { title: 'Deterministic Safety Checks', desc: 'Hard-coded algorithms block cross-reactive allergy conflicts and invalid medication parameters.' },
              { title: 'Strict Physician Governance', desc: 'Zero autonomous prescribing. Every order requires explicit doctor sign-off.' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/20 transition-all">
                <div className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={12} className="stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-white">{item.title}</h4>
                  <p className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Synthetic Boundary Box */}
          <div className="mt-8 p-3.5 rounded-xl bg-black/40 border border-cyan-500/20 text-xs font-mono text-slate-400 flex items-start gap-3">
            <Shield size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-cyan-300 font-bold">SYNTHETIC EVALUATION HARNESS:</span>{' '}
              Preloaded with realistic multi-encounter patient trajectories (Eleanor Vance, Arthur Pendelton) for physician evaluation.
            </div>
          </div>
        </div>

        {/* ── Right: Elevated HUD Login Card (Images 1 & 2 Inspiration) ── */}
        <div className="w-full max-w-[420px] shrink-0 proton-animate-in" style={{ animationDelay: '100ms' }}>
          <div className="proton-lumen-card p-8 sm:p-9 relative">
            
            {/* Top Card HUD Tag */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">[PORTAL // AUTH]</span>
                <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                  Physician Sign-In
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            {error && (
              <div className="mb-6 bg-rose-950/60 border border-rose-500/50 p-3 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4 font-sans" onSubmit={handleLogin}>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 pl-0.5">
                  Physician Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@proton.local"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 pl-0.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-sans"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="proton-pill-cyan w-full py-3 justify-center text-sm font-semibold cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Physician Workspace</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Fill One-Click Access */}
            <div className="mt-7 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-slate-400 mb-3 font-sans">Evaluating Proton for the first time?</p>
              <button
                type="button"
                onClick={handleQuickFillSyntheticDoctor}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-cyan-300 flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-cyan-400" />
                  <span>Use Synthetic Evaluation Account</span>
                </div>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform text-slate-400" />
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-7xl w-full mx-auto px-6 py-5 text-center text-[11px] font-mono text-slate-500 border-t border-white/5">
        <p>PROTON CLINICAL OS &bull; SYNTHETIC EVALUATION ENVIRONMENT &bull; FHIR R4 BACKED</p>
      </footer>

      {/* ── How Proton Works Modal ── */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 proton-animate-in">
          <div className="bg-[#080d1a] rounded-3xl max-w-2xl w-full p-7 border border-cyan-500/30 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg flex items-center justify-center">
                  <Activity size={17} />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-cyan-400">[ARCHITECTURE_BRIEF]</div>
                  <h3 className="text-base font-bold text-white">How Proton Works</h3>
                </div>
              </div>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {workflowSteps.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3.5">
                    <div className="h-7 w-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-cyan-400 font-bold">{s.num} // {s.step}</span>
                        <h4 className="text-xs font-semibold text-white">{s.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowHowItWorks(false)}
                className="proton-pill-cyan text-xs py-2 px-5 cursor-pointer"
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
