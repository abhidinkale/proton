import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Menu,
  X,
  Terminal,
  Check
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'trajectory' | 'provenance'>('today');
  const [loopActiveStage, setLoopActiveStage] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Bioluminescent particle canvas animation (Images 1 & 2 inspired)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes for bioluminescent flower / neural cluster
    const numParticles = 65;
    const particles = Array.from({ length: numParticles }, (_, i) => {
      const angle = (i / numParticles) * Math.PI * 2;
      const radius = 60 + Math.random() * 110;
      return {
        baseX: width / 2 + Math.cos(angle) * radius,
        baseY: height / 2 + Math.sin(angle) * radius * 0.7,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius * 0.7,
        size: Math.random() * 2.2 + 1,
        speed: 0.001 + Math.random() * 0.002,
        phase: Math.random() * Math.PI * 2,
        color: i % 3 === 0 ? '#38bdf8' : i % 3 === 1 ? '#2dd4bf' : '#818cf8',
        pulse: Math.random() * 0.5 + 0.5
      };
    });

    let time = 0;
    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Center glowing bioluminescent bloom
      const centerX = width / 2;
      const centerY = height / 2;
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 10,
        centerX, centerY, Math.min(width, height) * 0.45
      );
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      gradient.addColorStop(0.3, 'rgba(45, 212, 191, 0.12)');
      gradient.addColorStop(0.7, 'rgba(129, 140, 248, 0.04)');
      gradient.addColorStop(1, 'rgba(6, 8, 16, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Update and draw neural connection lines
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.x = p1.baseX + Math.sin(time + p1.phase) * 14;
        p1.y = p1.baseY + Math.cos(time + p1.phase * 1.5) * 12;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 75) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.28 * (1 - dist / 75)})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // Draw glowing particle nodes
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Central core pulse ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 28 + Math.sin(time * 2) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#05070f] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 antialiased overflow-x-hidden">

      {/* ── 1. HUD TOP BAR (Reference 2: LÜMEN // ÍNDEX Inspiration) ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#05070f]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Clinical System Identifier */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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

          {/* Center HUD Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-[12px] font-mono tracking-wider uppercase text-slate-400">
            <button 
              onClick={() => scrollToSection('the-loop')}
              className="hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="text-cyan-500 text-[10px]">01.</span> The Proton Loop
            </button>
            <button 
              onClick={() => scrollToSection('patient-intelligence')}
              className="hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="text-cyan-500 text-[10px]">02.</span> Patient Intelligence
            </button>
            <button 
              onClick={() => scrollToSection('verification')}
              className="hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="text-cyan-500 text-[10px]">03.</span> Verification
            </button>
            <button 
              onClick={() => scrollToSection('philosophy')}
              className="hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="text-cyan-500 text-[10px]">04.</span> Governance
            </button>
          </nav>

          {/* Right Status Badge & Primary Pill CTA */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>FHIR_R4: SYNCHRONIZED</span>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="proton-pill-cyan text-xs font-semibold py-2 px-4.5 cursor-pointer"
            >
              <span>Enter Workspace</span>
              <ArrowRight size={14} className="stroke-[2.5]" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-[#05070f]/95 px-6 py-5 space-y-4">
            <button
              onClick={() => scrollToSection('the-loop')}
              className="block w-full text-left py-2 text-sm font-mono text-slate-300 hover:text-cyan-400"
            >
              01 // THE PROTON LOOP
            </button>
            <button
              onClick={() => scrollToSection('patient-intelligence')}
              className="block w-full text-left py-2 text-sm font-mono text-slate-300 hover:text-cyan-400"
            >
              02 // PATIENT INTELLIGENCE
            </button>
            <button
              onClick={() => scrollToSection('verification')}
              className="block w-full text-left py-2 text-sm font-mono text-slate-300 hover:text-cyan-400"
            >
              03 // CLINICAL VERIFICATION
            </button>
            <button
              onClick={() => scrollToSection('philosophy')}
              className="block w-full text-left py-2 text-sm font-mono text-slate-300 hover:text-cyan-400"
            >
              04 // CLINICAL GOVERNANCE
            </button>
          </div>
        )}
      </header>

      {/* ── 2. HERO: BIOLUMINESCENT HUD ENVIRONMENT (Images 1 & 2 Inspiration) ── */}
      <section className="relative proton-hud-grid min-h-[92vh] pt-28 pb-20 flex flex-col justify-center overflow-hidden">
        
        {/* Subtle coordinate crosshairs at grid intersections */}
        <div className="absolute top-24 left-8 text-white/20 font-mono text-xs select-none pointer-events-none">+</div>
        <div className="absolute top-24 right-8 text-white/20 font-mono text-xs select-none pointer-events-none">+</div>
        <div className="absolute bottom-12 left-8 text-white/20 font-mono text-xs select-none pointer-events-none">+</div>
        <div className="absolute bottom-12 right-8 text-white/20 font-mono text-xs select-none pointer-events-none">+</div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left: Headline & Editorial Narrative */}
            <div className="lg:col-span-6 flex flex-col items-start proton-animate-in">
              
              {/* Telemetry Micro Tag */}
              <div className="proton-hud-tag mb-5 px-2.5 py-1 rounded bg-cyan-950/30 border border-cyan-500/20 text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                [INTELLIGENCE_LAYER // AMBIENT_CLINICAL_OS]
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
                Liquid Context.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-indigo-300">
                  Luminous Decisions.
                </span>
              </h1>

              {/* Product Thesis */}
              <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-xl">
                What does a physician need to know about this patient <span className="text-white font-medium underline decoration-cyan-400 underline-offset-4">right now</span>? Proton synthesizes fragmented consultations, lab drifts, and longitudinal history into immediate clinical situational awareness.
              </p>

              {/* Primary & Secondary Pill CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="proton-pill-cyan text-sm py-3 px-6 cursor-pointer"
                >
                  <Sparkles size={15} />
                  <span>Enter Physician Workspace</span>
                  <ArrowRight size={15} />
                </button>

                <button
                  onClick={() => scrollToSection('the-loop')}
                  className="proton-pill-dark text-sm py-3 px-5.5 cursor-pointer"
                >
                  <span>See How Proton Works</span>
                </button>
              </div>

              {/* Technical Footnote */}
              <div className="mt-10 flex items-center gap-3 text-[11px] font-mono text-slate-400">
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                  BETA_v1.4
                </span>
                <span>PHYSICIAN FINAL AUTHORITY • ZERO AUTONOMOUS PRESCRIBING</span>
              </div>
            </div>

            {/* Right: Bioluminescent Organism Canvas with HUD Node Callouts (Image 2 Inspiration) */}
            <div className="lg:col-span-6 relative flex items-center justify-center proton-animate-in">
              <div className="relative w-full max-w-[540px] aspect-square rounded-3xl p-1 flex items-center justify-center">
                
                {/* HTML5 Particle Canvas */}
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-full rounded-2xl block"
                />

                {/* HUD Pointer Callout 1 (Top Right): [CORE_ENTITY] */}
                <div className="absolute top-6 right-2 sm:right-6 max-w-[210px] proton-hud-bracket p-3 rounded-lg text-left hidden sm:block">
                  <div className="text-[10px] font-mono text-cyan-400 font-bold tracking-wider">
                    [CORE_ENTITY]
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug mt-1 font-sans">
                    Neural context engine synthesizing ambient conversation into structured FHIR records.
                  </p>
                </div>

                {/* HUD Pointer Callout 2 (Bottom Left): [TEMPORAL_MEMORY] */}
                <div className="absolute bottom-8 left-2 sm:left-4 max-w-[220px] proton-hud-bracket p-3 rounded-lg text-left hidden sm:block">
                  <div className="text-[10px] font-mono text-teal-400 font-bold tracking-wider">
                    [TEMPORAL_MEMORY]
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug mt-1 font-sans">
                    Tracks HbA1c trajectories, past titrations, and unresolved adherence flags.
                  </p>
                </div>

                {/* Bottom Center Mini HUD Badge */}
                <div className="absolute bottom-2 right-4 px-3 py-1.5 rounded-full bg-[#05070f]/90 border border-white/10 text-[10px] font-mono text-slate-400 flex items-center gap-2 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>LATENCY: 18ms // DETERMINISTIC SAFE</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Editorial Callout Ribbon (Reference 2: NOT A BANK — AN ECOSYSTEM equivalent) */}
        <div className="mt-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                CLINICAL THESIS
              </span>
              <p className="text-xs sm:text-sm text-slate-300">
                <span className="text-white font-medium">Proton is not a passive chatbot.</span> It is a physician command center where AI proposes, highlights, and verifies — but the doctor remains the absolute authority.
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-4 flex items-center gap-1 shrink-0"
            >
              <span>ACCESS EVALUATION WORKSPACE</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. THE 6 CLINICAL FRICTION POINTS (Clean HUD Matrix) ── */}
      <section className="py-24 bg-[#080d1a] border-t border-b border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-16">
            <div className="proton-hud-tag mb-3">[THE_CLINICAL_BOTTLENECK]</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Fragmented Information.<br />
              <span className="text-slate-400">Scattered Across Incompatible Silos.</span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
              Physicians spend up to 2 hours documenting for every 1 hour of patient care. The challenge isn&apos;t a lack of data — it is synthesizing what matters before stepping into the examination room.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                num: '01',
                title: 'EHR Chart Archaeology',
                desc: 'Hunting through 40 pages of legacy visit notes and PDF lab reports just to verify past medication tolerance.',
                metric: '4-8 min lost per patient'
              },
              {
                num: '02',
                title: 'Unnoticed Temporal Drift',
                desc: 'Lab values creeping upward (HbA1c 7.1% → 8.2%) across disjointed consultations without automatic trend detection.',
                metric: 'High clinical oversight risk'
              },
              {
                num: '03',
                title: 'Ambient Documentation Fatigue',
                desc: 'Staring at a screen typing during consultations instead of maintaining eye contact and rapport with the patient.',
                metric: '2.5 hrs daily after-hours charting'
              },
              {
                num: '04',
                title: 'Cross-Reactivity Blind Spots',
                desc: 'Missing penicillin cross-reactivity warnings on cephalosporins buried in outdated allergy lists.',
                metric: 'Preventable adverse events'
              },
              {
                num: '05',
                title: 'Uncited AI Hallucinations',
                desc: 'Generic LLMs inventing clinical claims with zero link to confirmed FHIR observations or source audio.',
                metric: 'Loss of physician trust'
              },
              {
                num: '06',
                title: 'Amnesiac Medical Records',
                desc: 'Each visit treated in isolation; past patient struggles and unresolved questions forgotten by the system.',
                metric: 'Fragmented continuity of care'
              }
            ].map((item, idx) => (
              <div 
                key={idx}
                className="proton-lumen-card p-6 flex flex-col justify-between group hover:border-cyan-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-cyan-400 font-bold">{item.num} //</span>
                    <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-white/5">
                      {item.metric}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-5 pt-3 border-t border-white/5 flex items-center text-[10px] font-mono text-slate-500 group-hover:text-cyan-400 transition-colors">
                  <span>RESOLVED BY PROTON OS</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 4. THE PROTON CLINICAL LOOP (Image 2 + 4 Inspired: 7-Stage Pipeline) ── */}
      <section id="the-loop" className="py-24 bg-[#05070f] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="proton-hud-tag mb-3">[SYSTEM_PIPELINE]</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              The Proton Clinical Loop
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Seven deterministic stages. The physician remains the final authority at every transition.
            </p>
          </div>

          {/* Interactive Pipeline Tabs */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 mb-10">
            {[
              { id: 1, name: 'Capture' },
              { id: 2, name: 'Understand' },
              { id: 3, name: 'Draft' },
              { id: 4, name: 'Verify' },
              { id: 5, name: 'Review' },
              { id: 6, name: 'Approve' },
              { id: 7, name: 'Remember' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setLoopActiveStage(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
                  loopActiveStage === tab.id
                    ? 'bg-cyan-500 text-black font-bold shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                0{tab.id} // {tab.name}
              </button>
            ))}
          </div>

          {/* Detailed Stage Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-xl">
            
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span>STAGE 0{loopActiveStage} OF 07</span>
              </div>

              {loopActiveStage === 1 && (
                <>
                  <h3 className="text-2xl font-bold text-white">Capture Ambient Dialogue</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Live microphone streaming securely feeds raw conversational dialogue to Proton. Zero third-party audio retention. Works seamlessly in background mode without altering exam-room dynamics.
                  </p>
                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs font-mono text-cyan-300">
                    STATUS: SECURE STREAM ACTIVE &bull; 16kHz PCM &bull; ZERO CLIENT API KEYS
                  </div>
                </>
              )}

              {loopActiveStage === 2 && (
                <>
                  <h3 className="text-2xl font-bold text-white">Understand & Extract</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Proton maps dialogue tokens to clinical ontologies (SNOMED-CT, RxNorm, LOINC). Extracts symptoms, dosages, frequencies, and changes against historical baselines.
                  </p>
                  <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/20 text-xs font-mono text-teal-300">
                    EXTRACTION: 14 CLINICAL ENTITIES &bull; CONFIDENCE: 98.4%
                  </div>
                </>
              )}

              {loopActiveStage === 3 && (
                <>
                  <h3 className="text-2xl font-bold text-white">Draft Structured Note</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Instantly compiles subjective and objective data into standard SOAP or General Consultation templates. Every line is explicitly labeled with <code className="text-cyan-300">[AI_DRAFT]</code> until reviewed.
                  </p>
                  <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs font-mono text-indigo-300">
                    SCHEMA: FHIR R4 CLINICAL IMPRESSION &bull; SOAP GENERATED IN 1.2s
                  </div>
                </>
              )}

              {loopActiveStage === 4 && (
                <>
                  <h3 className="text-2xl font-bold text-white">Deterministic Verification</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Hard-coded rule verification checks for required sections, invalid dosages, potential allergy cross-reactivity, and duplicate therapies. No hallucinated rules.
                  </p>
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs font-mono text-amber-300">
                    SAFETY GATE: 6 CHECKS RUN &bull; 1 ALLERGY CONFLICT FLAGGED FOR REVIEW
                  </div>
                </>
              )}

              {loopActiveStage === 5 && (
                <>
                  <h3 className="text-2xl font-bold text-white">Physician Review & Provenance</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    The physician inspects every extracted fact alongside verbatim transcript quotes. Clicking any recommendation highlights the exact moment in the consultation.
                  </p>
                  <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-blue-300">
                    PROVENANCE: 100% AUDITABLE &bull; VERBATIM TRANSCRIPT SNIPPETS LINKED
                  </div>
                </>
              )}

              {loopActiveStage === 6 && (
                <>
                  <h3 className="text-2xl font-bold text-white">Physician Explicit Approval</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Nothing is committed automatically. The physician modifies phrasing, clears warnings, and explicitly signs off. Provenance shifts to <code className="text-emerald-300">[PHYSICIAN_APPROVED]</code>.
                  </p>
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs font-mono text-emerald-300">
                    SIGN-OFF: CRYPTOGRAPHIC SIGNATURE &bull; ATTENDING PHYSICIAN IDENTITY
                  </div>
                </>
              )}

              {loopActiveStage === 7 && (
                <>
                  <h3 className="text-2xl font-bold text-white">Longitudinal Memory</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Approved clinical impressions, prescribed medications, and observation trends persist permanently to the FHIR store, forming the memory baseline for future visits.
                  </p>
                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs font-mono text-cyan-300">
                    PERSISTENCE: FHIR ATOMIC BATCH TRANSACTION &bull; LONGITUDINAL SYNCED
                  </div>
                </>
              )}
            </div>

            {/* Right: Stage Visual Mockup */}
            <div className="lg:col-span-7 bg-[#080e1c] border border-cyan-500/20 rounded-2xl p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 text-xs font-mono">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Terminal size={14} />
                  <span>PROTON_TERMINAL // STAGE_0{loopActiveStage}</span>
                </div>
                <span className="text-slate-400">EVALUATION HARNESS</span>
              </div>

              {/* Dynamic Mockup Viewport */}
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-slate-300">
                  <span className="text-cyan-400">&gt; Patient:</span> Eleanor Vance (68F) &bull; MRN: #PT-84920
                </div>
                
                <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold">[SAFETY_CHECK]</span> Penicillin Cross-Reactivity Alert
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] border border-rose-800">
                    BLOCKED
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-slate-300">
                  <span className="text-slate-400">Extracted Fact:</span> Metformin titrated from 500mg BID to 1000mg BID
                  <div className="mt-1 text-[11px] text-teal-400 font-sans">
                    &quot;Let&apos;s increase your metformin to 1000 milligrams twice daily with meals.&quot; (03:14)
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>AUDIT TRAIL: IMMUTABLE</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> DOCTOR DECISION REQUIRED
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 5. WHAT MATTERS TODAY: CLINICAL BRAIN DECK (Image 3: MYDNA Inspiration) ── */}
      <section id="patient-intelligence" className="py-24 bg-[#080d1a] border-t border-b border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="proton-hud-tag mb-3">[PRE_CONSULTATION_BRIEF]</div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                What Matters Today
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                A 10-second situational brief generated from longitudinal FHIR memory before entering the room.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-full border border-white/10 self-start md:self-auto">
              {(['today', 'trajectory', 'provenance'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Intelligence Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card 1: Critical Allergy */}
            <div className="proton-lumen-card p-5 border-rose-500/30 hover:border-rose-500/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-rose-400 font-bold">[ALERT // ALLERGY]</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                  CRITICAL
                </span>
              </div>
              <h4 className="text-sm font-semibold text-rose-200">Penicillin (Severe)</h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Documented anaphylactic reaction with bronchospasm. Avoid amoxicillin &amp; 1st-gen cephalosporins.
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                Source: AllergyIntolerance &bull; Confirmed
              </div>
            </div>

            {/* Card 2: HbA1c Drift Sparkline */}
            <div className="proton-lumen-card p-5 border-amber-500/30 hover:border-amber-500/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-amber-400 font-bold">[DRIFT // GLYCEMIC]</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                  +1.1% ESCALATION
                </span>
              </div>
              <h4 className="text-sm font-semibold text-amber-200">HbA1c: 7.1% → 8.2%</h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Gradual elevation across past 6 months. Fasting blood sugars consistently exceed target range.
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                Observation/Lab &bull; 12 Oct 2026
              </div>
            </div>

            {/* Card 3: Medication Titration */}
            <div className="proton-lumen-card p-5 border-cyan-500/30 hover:border-cyan-500/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-cyan-400 font-bold">[MEDICATION // DOSE]</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                  TITRATION
                </span>
              </div>
              <h4 className="text-sm font-semibold text-cyan-200">Metformin 1000mg BID</h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Dose titrated from 500mg BID last visit. Tolerating well with zero gastrointestinal side effects.
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                MedicationRequest &bull; 04 Sep 2026
              </div>
            </div>

            {/* Card 4: Adherence Flag */}
            <div className="proton-lumen-card p-5 border-indigo-500/30 hover:border-indigo-500/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-indigo-400 font-bold">[FOLLOW_UP // ADHERENCE]</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800">
                  PENDING
                </span>
              </div>
              <h4 className="text-sm font-semibold text-indigo-200">Lisinopril Compliance</h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Patient noted missing doses on weekends due to cough. Needs formal review today.
              </p>
              <div className="mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                Encounter Note &bull; 04 Sep 2026
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 6. VERIFICATION & CLINICAL GOVERNANCE ── */}
      <section id="verification" className="py-24 bg-[#05070f] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="proton-hud-tag">[DETERMINISTIC_SAFETY_ENGINE]</div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Zero Autonomous Prescribing.<br />
                <span className="text-cyan-400">Zero Uncited Claims.</span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Most AI healthcare products act as loose chatbots. Proton treats clinical safety as a hard deterministic compiler. If a prescription lacks an explicit dose, frequency, or duration, or contradicts a known allergy, the system actively blocks it.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  {
                    title: 'Cross-reactive allergy blocking',
                    desc: 'Flags amoxicillin, ampicillin, and cephalosporins against documented penicillin anaphylaxis.'
                  },
                  {
                    title: 'Mandatory prescription field gating',
                    desc: 'Orders without route, frequency, or duration cannot be submitted to the clinical record.'
                  },
                  {
                    title: 'Verbatim transcript grounding',
                    desc: 'Every extracted observation highlights the audio timestamp and transcript quote.'
                  },
                  {
                    title: 'Explicit physician signature',
                    desc: 'Nothing persists to FHIR memory without the attending physician’s explicit confirmation.'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={12} className="stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Verification Matrix Visual (Radial & Checks) */}
            <div className="lg:col-span-6 bg-gradient-to-b from-[#0a1324] to-[#060a14] border border-cyan-500/30 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <div>
                  <div className="text-xs font-mono text-cyan-400 font-bold">[VERIFICATION_AUDIT_REPORT]</div>
                  <div className="text-sm font-semibold text-white mt-0.5">Consultation Safety Assessment</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 font-mono text-xs border border-emerald-500/40">
                  PASSED (1 WARNING)
                </span>
              </div>

              {/* Checklist items */}
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Chief Complaint Present</div>
                      <div className="text-[11px] text-slate-400">Documented: Follow-up type 2 diabetes mellitus</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">VERIFIED</span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-amber-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className="text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Potential Cross-Reactivity</div>
                      <div className="text-[11px] text-slate-400">Patient has documented penicillin allergy</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400">ACKNOWLEDGED</span>
                </div>

                <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Medication Parameters Complete</div>
                      <div className="text-[11px] text-slate-400">Dose, route, frequency, and duration validated</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">VERIFIED</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                <div className="text-xs font-mono text-slate-400">
                  RULESET: DETERMINISTIC_CLINICAL_v2.1
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="proton-pill-cyan text-xs py-2 px-4 cursor-pointer"
                >
                  Test In Workspace
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 7. PHILOSOPHY & GOVERNANCE (Image 5 Inspiration) ── */}
      <section id="philosophy" className="py-24 bg-[#080d1a] border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="max-w-3xl mx-auto">
            <div className="proton-hud-tag mb-4">[CLINICAL_GOVERNANCE_MANIFESTO]</div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              AI should reduce cognitive load.<br />
              <span className="text-cyan-400">Never replace clinical judgment.</span>
            </h2>
            <p className="mt-6 text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              Proton is built around one uncompromising principle: medicine belongs to the physician. The technology exists to unburden the doctor from administrative friction, illuminate clinical context, and verify safety protocols.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {[
              {
                title: 'AI drafts.',
                subtitle: 'Physicians decide.',
                desc: 'Every note and diagnostic summary remains in draft mode until reviewed and confirmed.'
              },
              {
                title: 'AI remembers.',
                subtitle: 'Physicians approve.',
                desc: 'Nothing becomes part of the permanent medical record without explicit physician sign-off.'
              },
              {
                title: 'AI surfaces.',
                subtitle: 'Physicians interpret.',
                desc: 'Trends and lab drifts are illuminated as raw evidence, not prescriptive medical advice.'
              },
              {
                title: 'AI verifies.',
                subtitle: 'Physicians own.',
                desc: 'Deterministic safety rules act as an alert barrier. Final therapeutic ownership rests with the doctor.'
              }
            ].map((p, idx) => (
              <div key={idx} className="proton-lumen-card p-6 border-white/10">
                <div className="text-lg font-bold text-white">{p.title}</div>
                <div className="text-sm font-semibold text-cyan-400 mt-0.5">{p.subtitle}</div>
                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── 8. CALL TO ACTION ── */}
      <section className="py-28 bg-[#05070f] relative text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/20 to-transparent pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="proton-hud-tag mb-4">[EVALUATION_PORTAL]</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Experience Proton in Practice
          </h2>
          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
            Explore the clinical command center, review synthetic patient trajectories, and test ambient documentation workflows.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="proton-pill-cyan text-sm py-3.5 px-8 cursor-pointer shadow-[0_0_30px_rgba(56,189,248,0.5)]"
            >
              <span>Enter Physician Workspace</span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="mt-8 text-xs font-mono text-slate-500">
            CONTROLLED EVALUATION ENVIRONMENT &bull; SYNTHETIC TEST PATIENTS ONLY &bull; NO PHI
          </div>
        </div>
      </section>

      {/* ── 9. FOOTER ── */}
      <footer className="border-t border-white/5 bg-[#03050a] py-12 text-slate-500 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Activity size={13} />
            </div>
            <span className="text-slate-300 font-bold tracking-wider">PROTON CLINICAL OS</span>
            <span>&bull;</span>
            <span>PHYSICIAN COPILOT</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => scrollToSection('the-loop')} className="hover:text-slate-300">LOOP</button>
            <button onClick={() => scrollToSection('patient-intelligence')} className="hover:text-slate-300">INTELLIGENCE</button>
            <button onClick={() => scrollToSection('verification')} className="hover:text-slate-300">VERIFICATION</button>
            <button onClick={() => navigate('/login')} className="text-cyan-400 hover:text-cyan-300">WORKSPACE</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
