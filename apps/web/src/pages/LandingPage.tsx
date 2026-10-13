import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedLoopStage, setSelectedLoopStage] = useState(1);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  // Interactive dynamic particle atmosphere surrounding the human touch artwork
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = (canvas.width = canvas.offsetWidth * dpr);
    let height = (canvas.height = canvas.offsetHeight * dpr);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * dpr;
      height = canvas.height = canvas.offsetHeight * dpr;
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Ambient floating point particles
    const particleCount = 75;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: -0.0002 - Math.random() * 0.0004,
      size: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.7 + 0.2,
      twinkle: Math.random() * Math.PI * 2
    }));

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Mouse parallax shift
      const mx = (mouseRef.current.x - 0.5) * 25 * dpr;
      const my = (mouseRef.current.y - 0.5) * 20 * dpr;

      // Render drifting clinical point particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = 1;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;

        const posX = p.x * width + mx;
        const posY = p.y * height + my;
        const currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(time + p.twinkle));

        ctx.beginPath();
        ctx.arc(posX, posY, p.size * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 240, 255, ${currentAlpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  const scrollToInfo = () => {
    const el = document.getElementById('core-intelligence');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#030407] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 antialiased overflow-x-hidden">

      {/* ── 1. MINIMAL TOP BAR ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 py-6 flex items-center justify-between backdrop-blur-md bg-[#030407]/60 border-b border-white/[0.04]">
        {/* Brand */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:border-cyan-400 transition-colors shadow-[0_0_12px_rgba(56,189,248,0.25)]">
            <Activity size={15} className="stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-wider text-white">PROTON</span>
            <span className="text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20">
              [MED_AI]
            </span>
          </div>
        </div>

        {/* Minimal Actions */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400">
            [SYNTHETIC_EVALUATION]
          </span>
          <button
            onClick={() => navigate('/login')}
            className="proton-pill-cyan text-xs py-2 px-5 cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.35)] hover:shadow-[0_0_25px_rgba(56,189,248,0.55)] transition-all"
          >
            <span>Enter Workspace</span>
            <ArrowRight size={13} className="stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* ── 2. HERO: ARTISTIC HUMAN CONNECTION ARTWORK ──────────────────── */}
      {/* Inspired by user uploaded image: Point-cloud doctor & patient meeting */}
      <section className="relative min-h-screen flex flex-col justify-between pt-24 pb-12 sm:pb-16 px-6 sm:px-12 lg:px-16 overflow-hidden">
        
        {/* Center Artwork Container with Vignette Fade & Particle Canvas Overlay */}
        <div className="flex-1 relative w-full flex items-center justify-center min-h-[48vh] sm:min-h-[58vh]">
          
          {/* Main Artwork with Soft Vignette Mask */}
          <div className="relative w-full max-w-4xl aspect-[16/9] flex items-center justify-center">
            <img
              src="/assets/hero-human-touch.png"
              alt="Physician and Patient Connection in Point-Cloud Data"
              className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-700 ease-[var(--ease-butter)] hover:scale-[1.01]"
              style={{
                maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 90%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 90%)'
              }}
            />

            {/* Interactive Floating Particle Atmosphere Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

        </div>

        {/* Bottom Lower Third: Split Editorial Content (page.62 composition) */}
        <div className="w-full max-w-7xl mx-auto pt-6 border-t border-white/[0.08] relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-end">
            
            {/* Left Column: Micro Tag + Bold Question Headline */}
            <div className="lg:col-span-7">
              <div className="text-xs font-mono text-cyan-400 mb-2.5 tracking-wider uppercase">
                proton.01 // clinical intelligence
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white tracking-tight leading-[1.12]">
                Ready to understand your patient before you walk in?
              </h1>
            </div>

            {/* Right Column: Concise Value Statement + Two Pill Buttons */}
            <div className="lg:col-span-5 flex flex-col items-start lg:items-end text-left lg:text-right space-y-5">
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-md">
                Proton synthesizes fragmented medical records, ambient consultation dialogue, and lab trends into immediate clinical awareness — while keeping the physician as final authority.
              </p>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-start lg:justify-end">
                <button
                  onClick={() => navigate('/login')}
                  className="proton-pill-cyan text-xs sm:text-sm py-2.5 sm:py-3 px-5 sm:px-6 cursor-pointer"
                >
                  <span>Enter Physician Workspace</span>
                </button>

                <button
                  onClick={scrollToInfo}
                  className="proton-pill-dark text-xs sm:text-sm py-2.5 sm:py-3 px-4.5 sm:px-5 cursor-pointer"
                >
                  <span>See How It Works</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* ── 3. ESSENTIAL CLINICAL INFORMATION (Google MedGemma Precision) ── */}

      {/* PILLAR 1: The 7-Stage Proton Loop */}
      <section id="core-intelligence" className="py-24 border-t border-white/5 bg-[#05070c] relative">
        <div className="max-w-6xl mx-auto px-6 sm:px-12">
          
          <div className="mb-12">
            <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">[THE_CLINICAL_LOOP]</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Seven stages. Physician authority at every step.
            </h2>
          </div>

          {/* Clean Horizontal Stage Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {[
              { id: 1, step: 'CAPTURE', desc: 'Ambient dialogue' },
              { id: 2, step: 'UNDERSTAND', desc: 'Ontology mapping' },
              { id: 3, step: 'DRAFT', desc: 'SOAP note synthesis' },
              { id: 4, step: 'VERIFY', desc: 'Deterministic safety' },
              { id: 5, step: 'REVIEW', desc: 'Verbatim citations' },
              { id: 6, step: 'APPROVE', desc: 'Doctor sign-off' },
              { id: 7, step: 'REMEMBER', desc: 'FHIR R4 memory' },
            ].map(stage => (
              <button
                key={stage.id}
                onClick={() => setSelectedLoopStage(stage.id)}
                className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer border ${
                  selectedLoopStage === stage.id
                    ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                }`}
              >
                <div className={`text-[10px] font-mono font-bold ${selectedLoopStage === stage.id ? 'text-cyan-400' : 'text-slate-500'}`}>
                  0{stage.id}
                </div>
                <div className="text-xs font-bold mt-1 text-white">{stage.step}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{stage.desc}</div>
              </button>
            ))}
          </div>

          {/* Active Stage Highlight Card */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="text-[10px] font-mono text-cyan-400">STAGE EXPLANATION</span>
              <h3 className="text-lg font-bold text-white mt-1">
                {selectedLoopStage === 1 && 'Capture: Ambient exam room dialogue streamed without client API keys'}
                {selectedLoopStage === 2 && 'Understand: Clinical entity extraction mapped to SNOMED and RxNorm'}
                {selectedLoopStage === 3 && 'Draft: Structured SOAP note compiled in seconds under strict prompts'}
                {selectedLoopStage === 4 && 'Verify: Deterministic algorithms check allergy conflicts and missing doses'}
                {selectedLoopStage === 5 && 'Review: The physician inspects each recommendation with verbatim audio quotes'}
                {selectedLoopStage === 6 && 'Approve: Explicit doctor confirmation required before anything is final'}
                {selectedLoopStage === 7 && 'Remember: Approved findings persist to FHIR for future visits'}
              </h3>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="proton-pill-cyan text-xs py-2.5 px-5 self-start md:self-auto cursor-pointer shrink-0"
            >
              Test In Workspace
            </button>
          </div>

        </div>
      </section>

      {/* PILLAR 2: What Matters Today (Pre-Consultation Brief) */}
      <section className="py-24 border-t border-white/5 bg-[#030407]">
        <div className="max-w-6xl mx-auto px-6 sm:px-12">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-[11px] font-mono text-teal-400 uppercase tracking-wider">[PRE_CONSULTATION_BRIEF]</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                What Matters Today
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Synthesized from Eleanor Vance (68F) longitudinal records in 10 seconds.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5 self-start md:self-auto">
              SYNTHETIC PATIENT EVALUATION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Item 1 */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-rose-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-rose-400 font-bold">ALLERGY ALERT</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                  CRITICAL
                </span>
              </div>
              <h4 className="text-sm font-semibold text-rose-200">Penicillin (Severe)</h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Documented anaphylactic reaction with bronchospasm. Avoid amoxicillin &amp; 1st-gen cephalosporins.
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                Source: AllergyIntolerance &bull; Active
              </div>
            </div>

            {/* Item 2 */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-amber-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-amber-400 font-bold">LAB DRIFT</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                  +1.1% ESCALATION
                </span>
              </div>
              <h4 className="text-sm font-semibold text-amber-200">HbA1c: 7.1% → 8.2%</h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Gradual elevation across past 6 months. Fasting blood sugars consistently exceed target range.
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                Source: Observation &bull; 12 Oct 2026
              </div>
            </div>

            {/* Item 3 */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-cyan-500/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-cyan-400 font-bold">MEDICATION CHANGE</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                  TITRATION
                </span>
              </div>
              <h4 className="text-sm font-semibold text-cyan-200">Metformin 1000mg BID</h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Dose titrated from 500mg BID last visit. Tolerating well with zero gastrointestinal side effects.
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                Source: MedicationRequest &bull; 04 Sep 2026
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* PILLAR 3: Clinical Governance */}
      <section className="py-24 border-t border-white/5 bg-[#05070c] text-center">
        <div className="max-w-3xl mx-auto px-6">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">[GOVERNANCE]</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2 leading-tight">
            AI should reduce cognitive load.<br />
            <span className="text-cyan-400">Never replace clinical judgment.</span>
          </h2>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            {[
              { rule: 'AI drafts.', authority: 'Physicians decide.' },
              { rule: 'AI remembers.', authority: 'Physicians approve.' },
              { rule: 'AI surfaces.', authority: 'Physicians interpret.' },
              { rule: 'AI verifies.', authority: 'Physicians own.' },
            ].map((g, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-sm font-bold text-white">{g.rule}</div>
                <div className="text-xs text-cyan-400 font-semibold mt-0.5">{g.authority}</div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <button
              onClick={() => navigate('/login')}
              className="proton-pill-cyan text-sm py-3 px-8 cursor-pointer"
            >
              <span>Enter Physician Workspace</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. CLEAN FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#020305] py-8 px-6 text-center text-xs font-mono text-slate-500">
        <p>PROTON CLINICAL OS &bull; SYNTHETIC BETA EVALUATION &bull; NO REAL PHI</p>
      </footer>

    </div>
  );
}
