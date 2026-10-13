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

  // Generative Halftone Bioluminescent Bloom (Matching uploaded page.62 design)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };
    window.addEventListener('resize', handleResize);

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const originX = width / 2;
      const originY = height * 0.50;

      // Soft ambient radial glow
      const radial = ctx.createRadialGradient(originX, originY, 15, originX, originY, Math.min(width, height) * 0.46);
      radial.addColorStop(0, 'rgba(56, 189, 248, 0.38)');
      radial.addColorStop(0.32, 'rgba(45, 212, 191, 0.18)');
      radial.addColorStop(0.68, 'rgba(14, 165, 233, 0.04)');
      radial.addColorStop(1, 'rgba(5, 7, 10, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, width, height);

      // Organic floral petals with subtle breathing wave
      const breathe = Math.sin(time) * 4;
      const petals = [
        // Upright back petal (slightly tilted right)
        { p0: [originX, originY], p1: [originX + 70 + breathe, originY - 140], p2: [originX + 110, originY - 260], maxW: 90 },
        // Upper left flared petal
        { p0: [originX, originY], p1: [originX - 120 - breathe, originY - 110], p2: [originX - 280, originY - 160], maxW: 105 },
        // Upper right flared petal
        { p0: [originX, originY], p1: [originX + 180 + breathe, originY - 110], p2: [originX + 340, originY - 130], maxW: 115 },
        // Far left sweeping petal
        { p0: [originX - 30, originY + 10], p1: [originX - 220 - breathe * 0.5, originY + 10], p2: [originX - 360, originY + 20], maxW: 110 },
        // Lower right sweeping petal
        { p0: [originX + 20, originY + 15], p1: [originX + 240 + breathe * 0.5, originY + 50], p2: [originX + 380, originY + 60], maxW: 115 },
        // Lower center petal
        { p0: [originX, originY], p1: [originX - 10, originY + 110 + breathe], p2: [originX + 40, originY + 170], maxW: 80 }
      ];

      function getDistanceToPetal(px: number, py: number, p0: number[], p1: number[], p2: number[], maxW: number) {
        let minDist = 9999;
        let bestT = 0;
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const mt = 1 - t;
          const bx = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
          const by = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
          const d = Math.hypot(px - bx, py - by);
          if (d < minDist) {
            minDist = d;
            bestT = t;
          }
        }
        const currentW = Math.sin(Math.pow(bestT, 0.7) * Math.PI) * maxW;
        if (minDist <= currentW) {
          const normDist = minDist / currentW;
          return (1 - normDist * normDist) * Math.sin(bestT * Math.PI);
        }
        return 0;
      }

      // Halftone dot rasterization
      const step = 5.2;
      const startX = originX - 440;
      const endX = originX + 440;
      const startY = originY - 290;
      const endY = originY + 220;

      for (let x = startX; x <= endX; x += step) {
        for (let y = startY; y <= endY; y += step) {
          let maxIntensity = 0;

          for (const p of petals) {
            const intensity = getDistanceToPetal(x, y, p.p0, p.p1, p.p2, p.maxW);
            if (intensity > maxIntensity) {
              maxIntensity = intensity;
            }
          }

          const distCenter = Math.hypot(x - originX, y - originY);
          let centerGlow = 0;
          if (distCenter < 55) {
            centerGlow = (1 - distCenter / 55) * 0.95;
          }

          const totalIntensity = Math.min(1, Math.max(maxIntensity, centerGlow));

          if (totalIntensity > 0.06) {
            const dotRadius = Math.max(0.6, totalIntensity * 2.5);
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);

            if (totalIntensity > 0.82) {
              ctx.fillStyle = '#ffffff';
            } else if (totalIntensity > 0.52) {
              ctx.fillStyle = '#7dd3fc';
            } else if (totalIntensity > 0.25) {
              ctx.fillStyle = '#38bdf8';
            } else {
              ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
            }
            ctx.fill();
          }
        }
      }

      // Mirror reflection below
      ctx.save();
      ctx.filter = 'blur(16px)';
      ctx.globalAlpha = 0.24;
      ctx.drawImage(canvas, 0, 0, width, height, 0, height * 0.46, width, height * 0.38);
      ctx.restore();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  const scrollToInfo = () => {
    const el = document.getElementById('core-intelligence');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 antialiased overflow-x-hidden">

      {/* ── 1. MINIMAL TOP BAR ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 py-6 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 cursor-pointer select-none group"
        >
          <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:border-cyan-400 transition-colors shadow-[0_0_12px_rgba(56,189,248,0.25)]">
            <Activity size={15} className="stroke-[2.5]" />
          </div>
          <span className="font-bold text-base tracking-wider text-white">PROTON</span>
        </div>

        {/* Minimal Actions */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400">
            [SYNTHETIC_EVALUATION]
          </span>
          <button
            onClick={() => navigate('/login')}
            className="proton-pill-cyan text-xs py-2 px-4.5 cursor-pointer"
          >
            <span>Enter Workspace</span>
            <ArrowRight size={13} className="stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* ── 2. HERO: EXACT PAGE.62 COMPOSITION ─────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-between pt-16 pb-12 sm:pb-16 px-6 sm:px-12 lg:px-16 overflow-hidden">
        
        {/* Top/Center: Luminous Halftone Flower Bloom */}
        <div className="flex-1 relative w-full flex items-center justify-center min-h-[50vh] sm:min-h-[58vh]">
          <canvas
            ref={canvasRef}
            className="w-full h-full max-w-5xl block"
          />
        </div>

        {/* Bottom Lower Third: Split Editorial Content (Matching page.62) */}
        <div className="w-full max-w-7xl mx-auto pt-6 border-t border-white/[0.06] relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-end">
            
            {/* Left Column: Micro Tag + Bold Question Headline */}
            <div className="lg:col-span-7">
              <div className="text-xs font-mono text-slate-400 mb-3 tracking-wider">
                proton.01
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

      {/* ── 3. MINIMAL ESSENTIAL CLINICAL INFORMATION ──────────────────── */}
      {/* (Only the strictly necessary pillars requested by user) */}

      {/* PILLAR 1: The 7-Stage Proton Loop */}
      <section id="core-intelligence" className="py-24 border-t border-white/5 bg-[#06080e] relative">
        <div className="max-w-6xl mx-auto px-6 sm:px-12">
          
          <div className="mb-12">
            <span className="text-[11px] font-mono text-cyan-400">[THE_CLINICAL_LOOP]</span>
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
              <span className="text-[10px] font-mono text-cyan-400">ACTIVE STAGE EXPLANATION</span>
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
      <section className="py-24 border-t border-white/5 bg-[#05070a]">
        <div className="max-w-6xl mx-auto px-6 sm:px-12">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-[11px] font-mono text-teal-400">[PRE_CONSULTATION_BRIEF]</span>
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
      <section className="py-24 border-t border-white/5 bg-[#06080e] text-center">
        <div className="max-w-3xl mx-auto px-6">
          <span className="text-[11px] font-mono text-slate-400">[GOVERNANCE]</span>
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
      <footer className="border-t border-white/5 bg-[#030508] py-8 px-6 text-center text-xs font-mono text-slate-500">
        <p>PROTON CLINICAL OS &bull; SYNTHETIC BETA EVALUATION &bull; NO REAL PHI</p>
      </footer>

    </div>
  );
}
