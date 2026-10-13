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

    // Ambient floating monochrome star & telemetry particles
    const particleCount = 85;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00025,
      vy: -0.0002 - Math.random() * 0.00035,
      size: Math.random() * 1.6 + 0.5,
      alpha: Math.random() * 0.75 + 0.15,
      twinkle: Math.random() * Math.PI * 2
    }));

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Mouse parallax shift
      const mx = (mouseRef.current.x - 0.5) * 20 * dpr;
      const my = (mouseRef.current.y - 0.5) * 16 * dpr;

      // Render drifting clinical point particles in pure bone white
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
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
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
    <div className="min-h-screen bg-blackgrain text-zinc-100 font-sans selection:bg-white selection:text-black antialiased overflow-x-hidden">

      {/* ── 1. MINIMAL LUXURY TOP BAR ─────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 py-5 flex items-center justify-between backdrop-blur-xl bg-black/60 border-b border-white/[0.08]">
        {/* Brand */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="h-8 w-8 rounded-lg bg-white text-black flex items-center justify-center font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] group-hover:bg-zinc-200 transition-all">
            <Activity size={16} strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-base tracking-[0.18em] text-white">PROTON</span>
            <span className="text-[9px] font-mono tracking-widest text-zinc-400 px-2 py-0.5 rounded bg-white/[0.04] border border-white/10">
              [CLINICAL_OS]
            </span>
          </div>
        </div>

        {/* Minimal Actions */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-block text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
            [SYNTHETIC_EVALUATION]
          </span>
          <button
            onClick={() => navigate('/login')}
            className="luxury-pill-white text-xs py-2 px-5 cursor-pointer"
          >
            <span>Enter Workspace</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {/* ── 2. HERO: ARTISTIC HUMAN CONNECTION ARTWORK ──────────────────── */}
      {/* Point-cloud doctor & patient meeting in pure black & white editorial elegance */}
      <section className="relative min-h-screen flex flex-col justify-between pt-28 pb-12 sm:pb-16 px-6 sm:px-12 lg:px-16 overflow-hidden">
        
        {/* Center Artwork Container with Subtle Luminous Lighting & Particle Canvas */}
        <div className="flex-1 relative w-full flex items-center justify-center min-h-[50vh] sm:min-h-[62vh]">
          
          {/* Subtle Ambient Vignette Lighting */}
          <div className="absolute w-[520px] h-[320px] bg-white/[0.035] rounded-full blur-3xl pointer-events-none" />

          {/* Main Artwork with Soft Vignette Mask */}
          <div className="relative w-full max-w-4xl aspect-[16/9] flex items-center justify-center">
            <img
              src="/assets/hero-human-touch.png"
              alt="Physician and Patient Connection in Point-Cloud Data"
              className="w-full h-full object-contain pointer-events-none select-none grayscale contrast-125 brightness-110 transition-transform duration-1000 ease-[var(--ease-butter)] hover:scale-[1.01]"
              style={{
                maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 48%, rgba(0,0,0,0) 88%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 48%, rgba(0,0,0,0) 88%)'
              }}
            />

            {/* Interactive Floating Particle Atmosphere Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

        </div>

        {/* Bottom Lower Third: Split Editorial Content */}
        <div className="w-full max-w-7xl mx-auto pt-8 border-t border-white/[0.08] relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-end">
            
            {/* Left Column: Micro Monospaced Tag + Sculptural Headline */}
            <div className="lg:col-span-7 space-y-3">
              <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.2em] text-zinc-400 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                [ 01 // LONGITUDINAL INTELLIGENCE ]
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.85rem] font-medium text-white tracking-tight leading-[1.12]">
                Ready to understand your patient before you walk in?
              </h1>
            </div>

            {/* Right Column: Concise Value Statement + Luxury Pill Buttons */}
            <div className="lg:col-span-5 flex flex-col items-start lg:items-end text-left lg:text-right space-y-6">
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-light max-w-md">
                Proton synthesizes fragmented medical records, ambient consultation dialogue, and lab trends into immediate clinical awareness — while keeping the physician as final authority.
              </p>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-start lg:justify-end">
                <button
                  onClick={() => navigate('/login')}
                  className="luxury-pill-white text-xs sm:text-sm py-2.5 sm:py-3 px-6 cursor-pointer"
                >
                  <span>Enter Physician Workspace</span>
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>

                <button
                  onClick={scrollToInfo}
                  className="luxury-pill-ghost text-xs sm:text-sm py-2.5 sm:py-3 px-5 cursor-pointer"
                >
                  <span>See How It Works</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* ── 3. ESSENTIAL CLINICAL INFORMATION (Swiss Editorial Precision) ── */}

      {/* PILLAR 1: The 7-Stage Proton Loop */}
      <section id="core-intelligence" className="py-24 border-t border-white/10 bg-blackgrain relative">
        <div className="max-w-6xl mx-auto px-6 sm:px-12">
          
          <div className="mb-12">
            <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-400 uppercase">[ 02 // THE CLINICAL LOOP ]</span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-1.5 tracking-tight">
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
                className={`p-3.5 rounded-xl text-left transition-all cursor-pointer border ${
                  selectedLoopStage === stage.id
                    ? 'bg-white text-black border-white shadow-[0_4px_25px_rgba(255,255,255,0.2)]'
                    : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:border-white/25 hover:text-white hover:bg-zinc-900/50'
                }`}
              >
                <div className={`text-[10px] font-mono font-bold tracking-wider ${selectedLoopStage === stage.id ? 'text-black/60' : 'text-zinc-500'}`}>
                  0{stage.id}
                </div>
                <div className={`text-xs font-bold mt-1 tracking-tight ${selectedLoopStage === stage.id ? 'text-black' : 'text-white'}`}>
                  {stage.step}
                </div>
                <div className={`text-[11px] mt-0.5 leading-snug ${selectedLoopStage === stage.id ? 'text-zinc-700' : 'text-zinc-400'}`}>
                  {stage.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Active Stage Highlight Card in Obsidian Glass */}
          <div className="p-7 rounded-2xl bg-zinc-950/80 border border-white/10 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
            <div className="max-w-xl">
              <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">[ STAGE 0{selectedLoopStage} // PROTOCOL SPECIFICATION ]</span>
              <h3 className="text-base sm:text-lg font-medium text-white mt-1.5 leading-relaxed">
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
              className="luxury-pill-white text-xs py-2.5 px-5 self-start md:self-auto cursor-pointer shrink-0"
            >
              <span>Test In Workspace</span>
              <ArrowRight size={13} />
            </button>
          </div>

        </div>
      </section>

      {/* PILLAR 2: What Matters Today (Pre-Consultation Brief) */}
      <section className="py-24 border-t border-white/10 bg-blackgrain">
        <div className="max-w-6xl mx-auto px-6 sm:px-12">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-400 uppercase">[ 03 // PRE-CONSULTATION BRIEF ]</span>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-1.5 tracking-tight">
                What Matters Today
              </h2>
              <p className="text-sm text-zinc-400 mt-1 font-light">
                Synthesized from Eleanor Vance (68F) longitudinal records in seconds.
              </p>
            </div>
            <span className="text-[10px] font-mono tracking-widest text-zinc-300 bg-white/[0.04] px-3.5 py-1.5 rounded-full border border-white/10 self-start md:self-auto">
              [ SYNTHETIC PATIENT EVALUATION // ELEANOR VANCE ]
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Item 1 */}
            <div className="p-6 rounded-2xl bg-zinc-950/80 border border-white/10 hover:border-white/25 transition-all shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-mono text-zinc-400 font-bold tracking-wider">[ ALLERGY ALERT ]</span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 tracking-wider">
                    CRITICAL
                  </span>
                </div>
                <h4 className="text-base font-semibold text-white">Penicillin (Severe)</h4>
                <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed font-light">
                  Documented anaphylactic reaction with bronchospasm. Avoid amoxicillin &amp; 1st-gen cephalosporins.
                </p>
              </div>
              <div className="mt-6 pt-3.5 border-t border-white/[0.08] text-[10px] font-mono text-zinc-500">
                SOURCE // AllergyIntolerance &bull; Active
              </div>
            </div>

            {/* Item 2 */}
            <div className="p-6 rounded-2xl bg-zinc-950/80 border border-white/10 hover:border-white/25 transition-all shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-mono text-zinc-400 font-bold tracking-wider">[ LAB DRIFT ]</span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 tracking-wider">
                    +1.1% ESCALATION
                  </span>
                </div>
                <h4 className="text-base font-semibold text-white">HbA1c: 7.1% → 8.2%</h4>
                <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed font-light">
                  Gradual elevation across past 6 months. Fasting blood sugars consistently exceed target range.
                </p>
              </div>
              <div className="mt-6 pt-3.5 border-t border-white/[0.08] text-[10px] font-mono text-zinc-500">
                SOURCE // Observation &bull; 12 Oct 2026
              </div>
            </div>

            {/* Item 3 */}
            <div className="p-6 rounded-2xl bg-zinc-950/80 border border-white/10 hover:border-white/25 transition-all shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-[10px] font-mono text-zinc-400 font-bold tracking-wider">[ MEDICATION CHANGE ]</span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20 tracking-wider">
                    TITRATION
                  </span>
                </div>
                <h4 className="text-base font-semibold text-white">Metformin 1000mg BID</h4>
                <p className="mt-2.5 text-xs text-zinc-400 leading-relaxed font-light">
                  Dose titrated from 500mg BID last visit. Tolerating well with zero gastrointestinal side effects.
                </p>
              </div>
              <div className="mt-6 pt-3.5 border-t border-white/[0.08] text-[10px] font-mono text-zinc-500">
                SOURCE // MedicationRequest &bull; 04 Sep 2026
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* PILLAR 3: Clinical Governance */}
      <section className="py-24 border-t border-white/10 bg-blackgrain text-center">
        <div className="max-w-3xl mx-auto px-6">
          <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-400 uppercase">[ 04 // CLINICAL GOVERNANCE ]</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium text-white mt-3 leading-tight tracking-tight">
            AI should reduce cognitive load.<br />
            <span className="text-zinc-400">Never replace clinical judgment.</span>
          </h2>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            {[
              { rule: 'AI drafts.', authority: 'Physicians decide.' },
              { rule: 'AI remembers.', authority: 'Physicians approve.' },
              { rule: 'AI surfaces.', authority: 'Physicians interpret.' },
              { rule: 'AI verifies.', authority: 'Physicians own.' },
            ].map((g, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-zinc-950/80 border border-white/10 hover:border-white/20 transition-all shadow-lg">
                <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">0{idx + 1}</div>
                <div className="text-sm font-semibold text-white mt-2">{g.rule}</div>
                <div className="text-xs text-zinc-400 font-medium mt-1">{g.authority}</div>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <button
              onClick={() => navigate('/login')}
              className="luxury-pill-white text-sm py-3.5 px-8 cursor-pointer"
            >
              <span>Enter Physician Workspace</span>
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. CLEAN MINIMALIST FOOTER ──────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-black/90 py-10 px-6 text-center text-xs font-mono text-zinc-500 space-y-2">
        <p className="tracking-widest">PROTON CLINICAL OS // CONTROLLED EVALUATION // MONOCHROME EDITION</p>
        <p className="text-[11px] text-zinc-600">Synthetic clinical environment &bull; No real Protected Health Information permitted</p>
      </footer>

    </div>
  );
}
