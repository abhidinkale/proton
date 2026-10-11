import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  HelpCircle, 
  X,
  Lock,
  AlertTriangle
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-brand-100 selection:text-brand-900">
      
      {/* TOP REGULATORY & SYNTHETIC DISCLAIMER BANNER */}
      <div className="bg-amber-500/10 border-b border-amber-200/80 px-4 py-2 text-center text-xs text-amber-900 font-medium">
        <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded mr-2">
          SYNTHETIC BETA — NO REAL PATIENT DATA
        </span>
        Controlled synthetic-data physician evaluation environment &bull; No real patient data permitted
      </div>

      {/* HEADER NAV */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-brand-600 text-white rounded-xl flex items-center justify-center shadow-xs">
            <Activity size={22} />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-slate-900">PROTON</span>
            <span className="ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 tracking-wider">
              Physician Web Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setShowHowItWorks(true)}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <HelpCircle size={16} /> How Proton Works
          </button>
        </div>
      </header>

      {/* MAIN HERO & LOGIN SECTION */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col lg:flex-row items-center gap-12 justify-center">
        
        {/* LEFT COLUMN: PRODUCT VALUE & SCOPE */}
        <div className="flex-1 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200/60 text-brand-700 text-xs font-semibold mb-4">
            <Sparkles size={14} /> AI Clinical Copilot for Physicians
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Turn every consultation into structured clinical intelligence.
          </h1>
          
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            An AI-native clinical copilot that augments physicians with intelligent documentation, 
            longitudinal patient memory, and actionable clinical insight &mdash; with the physician 
            remaining the final authority at every stage.
          </p>

          {/* KEY CLINICAL CAPABILITIES */}
          <div className="mt-8 space-y-3.5">
            {[
              {
                title: 'AI-assisted clinical documentation',
                desc: 'Ambient consultation capture structured cleanly into SOAP or General Consultation formats.'
              },
              {
                title: 'Longitudinal patient memory',
                desc: 'Synthesizes past visits, lab trends, and medical records into a unified chronological story.'
              },
              {
                title: 'Intelligent document understanding',
                desc: 'Extracts clinical facts, medications, and labs from uploaded reports with source quotes.'
              },
              {
                title: 'Physician-controlled workflows',
                desc: 'Zero autonomous prescribing or unverified commitments. Nothing is saved without your explicit sign-off.'
              },
              {
                title: 'Source-grounded clinical context',
                desc: 'Every AI suggestion displays transparent provenance, evidence, and confidence rating.'
              }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={13} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* PRIVACY & POSITIONING BOUNDARY */}
          <div className="mt-8 p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
            <Lock size={16} className="text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Controlled Synthetic Beta Scope:</span> Proton is currently deployed for evaluation with synthetic test patients. Real clinical data or autonomous diagnostic decisions are strictly excluded.
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGIN CARD */}
        <div className="w-full max-w-md shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Enter Physician Beta
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Access your physician workspace & patient panel
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Physician Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  className="appearance-none block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Password
                  </label>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="appearance-none block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loading ? 'Authenticating Physician...' : 'Enter Physician Beta'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </div>
            </form>

            {/* SYNTHETIC EVALUATOR HELPER */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500 mb-2.5">Evaluating Proton for the first time?</p>
              <button
                type="button"
                onClick={handleQuickFillSyntheticDoctor}
                className="w-full py-2 px-3 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/80 rounded-lg transition-colors cursor-pointer"
              >
                Use Synthetic Evaluation Account (Dr. Administrator)
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-6 text-center text-xs text-slate-400 border-t border-slate-100">
        <p>Proton Physician Web Beta &bull; Controlled Synthetic Evaluation Environment &bull; Designed for practicing physicians</p>
      </footer>

      {/* "HOW PROTON WORKS" MODAL */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-brand-100 text-brand-700 rounded-lg flex items-center justify-center">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">How Proton Works</h3>
                  <p className="text-xs text-slate-500">The 6-stage clinical documentation & memory lifecycle</p>
                </div>
              </div>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-6 space-y-4">
              {[
                { step: '1. CAPTURE', title: 'Clinical Dialogue Capture', text: 'Live microphone recording or guided dialogue. Audio streams securely to the backend transcription service with zero client API keys.' },
                { step: '2. DRAFT', title: 'Structured Note Synthesis', text: 'Configured Gemini AI model organizes dialogue into SOAP or General Consultation schemas under strict deterministic clinical prompts.' },
                { step: '3. VERIFY', title: 'Deterministic Safety Checks', text: 'Hardcoded algorithmic rules check required sections, dosage/frequency patterns, potential allergy cross-reactivity, and duplicate orders.' },
                { step: '4. REVIEW', title: 'Physician Review & Editing', text: 'The attending doctor reviews every suggestion. Every item is clearly labeled (AI DRAFT, AI EXTRACTED, or PHYSICIAN EDITED).' },
                { step: '5. APPROVE', title: 'Explicit Doctor Sign-Off', text: 'Nothing is confirmed automatically. The physician acknowledges warnings and signs off explicitly before persistence.' },
                { step: '6. REMEMBER', title: 'Longitudinal FHIR Memory', text: 'Approved clinical notes, prescriptions, and document facts persist atomically to FHIR standards and become part of longitudinal patient memory.' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-mono text-xs font-bold text-brand-700 uppercase px-2 py-0.5 rounded bg-brand-100 shrink-0">
                    {item.step}
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">{item.title}</h5>
                    <p className="text-xs text-slate-600 mt-0.5">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Physician is the final authority at every stage</span>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
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
