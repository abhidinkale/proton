import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Clock,
  Layers,
  Search,
  Database,
  Eye,
  Mic,
  Pill,
  TrendingUp,
  Check,
  History,
  Lock,
  Menu,
  X,
  Sparkle
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 font-sans selection:bg-brand-100 selection:text-brand-900 antialiased">

      {/* ── 1. NAVIGATION BAR ─────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="h-9 w-9 bg-brand-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-brand-600/30 group-hover:bg-brand-500 transition-colors">
              <Activity size={20} className="stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl tracking-tight text-white">PROTON</span>
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Physician Copilot
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <button 
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button 
              onClick={() => scrollToSection('clinical-intelligence')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Clinical Intelligence
            </button>
            <button 
              onClick={() => scrollToSection('for-physicians')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              For Physicians
            </button>
          </div>

          {/* Right CTA Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="proton-btn proton-btn-primary text-xs sm:text-sm font-semibold px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl shadow-md shadow-brand-600/20 hover:shadow-brand-600/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Enter Physician Workspace</span>
              <ArrowRight size={15} />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-800 bg-slate-950/95 px-4 py-4 space-y-3">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('clinical-intelligence')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              Clinical Intelligence
            </button>
            <button
              onClick={() => scrollToSection('for-physicians')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              For Physicians
            </button>
          </div>
        )}
      </nav>

      {/* ── 2. HERO SECTION ───────────────────────────────────────────── */}
      <section className="relative bg-slate-950 text-white proton-grid-pattern pt-32 pb-24 lg:pt-40 lg:pb-36 overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-brand-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Headlines & CTAs */}
            <div className="lg:col-span-7 flex flex-col items-start">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-950/80 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 backdrop-blur-sm shadow-sm">
                <Sparkle size={13} className="text-brand-400 fill-brand-400" />
                <span>✦ AI Clinical Copilot for Physicians</span>
              </div>

              {/* Main headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12]">
                Your patient&apos;s story. Understood before you walk in.
              </h1>

              {/* Subtitle explaining Proton in 2 sentences */}
              <p className="mt-6 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl font-normal">
                Proton synthesizes fragmented electronic health records, ambient consultations, and diagnostic reports into real-time clinical intelligence. Engineered exclusively for practicing physicians, it delivers continuous longitudinal context while preserving your clinical authority at every step.
              </p>

              {/* Two CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/login')}
                  className="proton-btn proton-btn-primary px-6 py-3.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 cursor-pointer"
                >
                  <span>Enter Physician Workspace</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="proton-btn proton-btn-ghost text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 px-6 py-3.5 text-sm font-medium rounded-xl cursor-pointer"
                >
                  See How Proton Works
                </button>
              </div>

              {/* Synthetic Beta evaluation notice */}
              <div className="mt-8 flex items-center gap-2.5 text-xs text-slate-400">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Controlled Synthetic Evaluation Environment &bull; No Real Patient PHI Required</span>
              </div>
            </div>

            {/* Right Column: Abstract Visualization 'What Matters Today' Floating Card */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md">
                {/* Visual backdrop blur halo */}
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 to-indigo-500/20 rounded-3xl blur-xl opacity-75" />
                
                {/* Floating card with slight rotation and shadow */}
                <div className="relative bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl shadow-brand-950/70 p-5 transform lg:rotate-1 hover:rotate-0 transition-transform duration-300 backdrop-blur-xl">
                  
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white tracking-wide">WHAT MATTERS TODAY</div>
                        <div className="text-[11px] text-slate-400">Eleanor Vance, 68F &bull; MRN #PT-84920</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-900/60 text-brand-300 border border-brand-700/50">
                      LIVE SYNTHESIS
                    </span>
                  </div>

                  {/* 3 Mock Items with Provenance Timestamps */}
                  <div className="mt-4 space-y-3">
                    
                    {/* Item 1: Penicillin allergy */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-rose-900/40 hover:border-rose-700/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-rose-200">Penicillin allergy</h4>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-900/50">
                          Critical
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300 leading-snug">
                        Documented anaphylactic reaction (bronchospasm) to amoxicillin. Cephalosporin precaution active.
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <Clock size={11} className="text-slate-500" />
                        <span>AllergyIntolerance &bull; Active &bull; 14 Jan 2021</span>
                      </div>
                    </div>

                    {/* Item 2: HbA1c increased 7.1→8.2% */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-amber-900/40 hover:border-amber-700/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={13} className="text-amber-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-amber-200">HbA1c increased 7.1% → 8.2%</h4>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-900/50">
                          Drift
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300 leading-snug">
                        Elevated glycemic index across 6 months. Fasting blood glucose averaged 164 mg/dL.
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <Clock size={11} className="text-slate-500" />
                        <span>Observation &bull; Fasting Panel &bull; 12 Oct 2026</span>
                      </div>
                    </div>

                    {/* Item 3: Medication change */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-blue-900/40 hover:border-blue-700/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Pill size={13} className="text-blue-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-blue-200">Medication change</h4>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/50">
                          Titration
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300 leading-snug">
                        Metformin titrated from 500mg daily to 1000mg BID. Monitor GI tolerability &amp; renal panel.
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <Clock size={11} className="text-slate-500" />
                        <span>Previous consultation &bull; 04 Sep 2026</span>
                      </div>
                    </div>

                  </div>

                  {/* Card Footer status */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      Deterministic EHR Grounding
                    </span>
                    <span className="text-slate-400 font-mono">3 alerts surfaced</span>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 3. THE PROBLEM SECTION ────────────────────────────────────── */}
      <section className="bg-white py-24 sm:py-32 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl">
            <div className="proton-micro-label text-brand-600 mb-3 tracking-widest">
              THE COGNITIVE OVERLOAD IN MODERN HEALTHCARE
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              Fragmented information. Scattered across systems.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Traditional electronic health records were engineered for administrative billing and compliance, not clinical decision-making. Physicians lose vital hours mentally stitching together fragmented stories.
            </p>
          </div>

          {/* 6 Pain Points Grid */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 01: Searching through records */}
            <div className="proton-card p-6 bg-slate-50/60 hover:bg-white transition-all group border-slate-200/80 hover:border-brand-300">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-brand-600 group-hover:text-brand-700 transition-colors">01</span>
                <Search size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Searching through records</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Clinicians spend up to 16 minutes per patient navigating endless tabs, archived PDFs, and buried encounter notes just to piece together baseline context.
              </p>
            </div>

            {/* 02: Reconstructing patient history */}
            <div className="proton-card p-6 bg-slate-50/60 hover:bg-white transition-all group border-slate-200/80 hover:border-brand-300">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-brand-600 group-hover:text-brand-700 transition-colors">02</span>
                <History size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Reconstructing patient history</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Critical disease milestones, therapeutic responses, and diagnostic patterns remain isolated in chronological logs rather than an actionable clinical narrative.
              </p>
            </div>

            {/* 03: Switching between systems */}
            <div className="proton-card p-6 bg-slate-50/60 hover:bg-white transition-all group border-slate-200/80 hover:border-brand-300">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-brand-600 group-hover:text-brand-700 transition-colors">03</span>
                <Layers size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Switching between systems</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Disjointed portals for lab data, radiology reports, pharmacy feeds, and scanned records force constant context-switching and introduce blind spots.
              </p>
            </div>

            {/* 04: Typing notes during consultations */}
            <div className="proton-card p-6 bg-slate-50/60 hover:bg-white transition-all group border-slate-200/80 hover:border-brand-300">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-brand-600 group-hover:text-brand-700 transition-colors">04</span>
                <FileText size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Typing notes during consultations</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Physicians are forced to look at monitors instead of patients, typing repetitive templates while cognitive fatigue compounds across the clinic day.
              </p>
            </div>

            {/* 05: Reviewing reports manually */}
            <div className="proton-card p-6 bg-slate-50/60 hover:bg-white transition-all group border-slate-200/80 hover:border-brand-300">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-brand-600 group-hover:text-brand-700 transition-colors">05</span>
                <Eye size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Reviewing reports manually</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Unstructured laboratory results, pathology biopsies, and outside specialist faxes must be read line-by-line, creating substantial risk of missed critical flags.
              </p>
            </div>

            {/* 06: Tracking medication changes */}
            <div className="proton-card p-6 bg-slate-50/60 hover:bg-white transition-all group border-slate-200/80 hover:border-brand-300">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold text-brand-600 group-hover:text-brand-700 transition-colors">06</span>
                <Pill size={18} className="text-slate-400 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">Tracking medication changes</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Complex polypharmacy regimens, cross-facility dose alterations, and discontinued medications create hazardous discrepancies without clear titration provenance.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. THE PROTON APPROACH ────────────────────────────────────── */}
      <section className="bg-slate-50 py-24 sm:py-32 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto">
            <div className="proton-micro-label text-brand-600 mb-3 tracking-widest">
              PARADIGM SHIFT
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              One coherent clinical story
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Proton transforms fragmented records into actionable patient intelligence
            </p>
          </div>

          {/* Before / After Comparison */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            
            {/* Left: Scattered EHR Reality */}
            <div className="proton-card bg-white p-8 border-slate-200 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500/80" />
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    LEGACY EHR REALITY
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Scattered &amp; Disjointed</span>
                </div>
                
                <h3 className="mt-6 text-xl font-bold text-slate-900">
                  Information Scattered in Static Silos
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Physicians manually navigate multiple screens, disparate PDF attachments, and buried encounter notes while trying to formulate care plans under severe time constraints.
                </p>

                <div className="mt-6 space-y-3">
                  {[
                    'Dozens of unstructured EHR tabs with disconnected histories',
                    'Buried drug allergies in archived encounter narratives',
                    'Static PDF lab reports requiring manual value transcription',
                    'No synthesized longitudinal view of biomarker drift',
                    'Physician types notes into rigid templates for 2+ hours after clinic',
                    'Risk of conflicting prescriptions from uncoordinated clinics'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                      <div className="h-4 w-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                        <X size={11} className="stroke-[3]" />
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Cognitive load: High</span>
                <span>Time per patient: 16–22 mins chart prep</span>
              </div>
            </div>

            {/* Right: Organized Proton View */}
            <div className="proton-card bg-white p-8 border-2 border-brand-500 flex flex-col justify-between shadow-lg shadow-brand-500/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-600" />
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                    THE PROTON APPROACH
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Synthesized &amp; Verified
                  </span>
                </div>
                
                <h3 className="mt-6 text-xl font-bold text-slate-900">
                  Continuous, Source-Grounded Intelligence
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Proton synthesizes medical records, ambient consultation audio, and lab telemetry into an actionable briefing — with every claim cited to its underlying source.
                </p>

                <div className="mt-6 space-y-3">
                  {[
                    'Instant 30-second "What Matters Today" pre-consultation summary',
                    'Deterministic safety checks highlight contraindications immediately',
                    'Ambient consultation capture drafts structured clinical SOAP notes',
                    'Longitudinal tracking connects lab anomalies across years',
                    'Strict physician authority: zero autonomous commitments or changes',
                    'Verifiable FHIR provenance and source citations on every insight'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 font-medium">
                      <div className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={11} className="stroke-[3]" />
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-brand-700 font-medium">
                <span>Cognitive load: Minimized</span>
                <span>Pre-consult briefing: Under 30 seconds</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 5. THE PROTON LOOP (MOST IMPORTANT VISUAL SECTION) ────────── */}
      <section id="how-it-works" className="bg-white py-24 sm:py-32 border-b border-slate-200 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto">
            <div className="proton-micro-label text-brand-600 mb-3 tracking-widest">
              THE CORE ARCHITECTURE
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              The Proton Clinical Loop
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Seven stages. Physician authority at every step.
            </p>
          </div>

          {/* Connecting Line & 7 Stages in Alternating Layout */}
          <div className="mt-20 relative">
            
            {/* Center Vertical Line (desktop) / Left Line (mobile) */}
            <div className="absolute left-6 md:left-1/2 top-4 bottom-4 -translate-x-1/2 w-0.5 bg-gradient-to-b from-brand-300 via-brand-600 to-brand-300" />

            <div className="space-y-12 md:space-y-16">
              
              {/* Stage 01: CAPTURE */}
              <div className="relative flex flex-col md:flex-row items-start md:items-center">
                {/* Node on line */}
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white border-2 border-brand-600 shadow-md flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-brand-700">01</span>
                </div>
                {/* Card - Left on desktop */}
                <div className="ml-14 md:ml-0 md:w-1/2 md:pr-14">
                  <div className="proton-card p-6 bg-slate-50/70 hover:bg-white transition-all border-slate-200">
                    <div className="flex items-center gap-2.5 text-brand-600 mb-2">
                      <Mic size={18} />
                      <span className="proton-micro-label">STAGE 01 &bull; CAPTURE</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Capture</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      Conversation, reports, documents and patient context flow into Proton.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>Ambient Audio</span> &bull; <span>PDFs</span> &bull; <span>FHIR Resources</span>
                    </div>
                  </div>
                </div>
                {/* Right empty space for alternating desktop alignment */}
                <div className="hidden md:block md:w-1/2" />
              </div>

              {/* Stage 02: UNDERSTAND */}
              <div className="relative flex flex-col md:flex-row items-start md:items-center">
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white border-2 border-brand-600 shadow-md flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-brand-700">02</span>
                </div>
                <div className="hidden md:block md:w-1/2" />
                {/* Card - Right on desktop */}
                <div className="ml-14 md:ml-0 md:w-1/2 md:pl-14">
                  <div className="proton-card p-6 bg-slate-50/70 hover:bg-white transition-all border-slate-200">
                    <div className="flex items-center gap-2.5 text-brand-600 mb-2">
                      <Sparkles size={18} />
                      <span className="proton-micro-label">STAGE 02 &bull; UNDERSTAND</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Understand</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      Proton organizes relevant clinical information into what matters today.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>Clinical Entity Extraction</span> &bull; <span>Longitudinal Synthesis</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 03: DRAFT */}
              <div className="relative flex flex-col md:flex-row items-start md:items-center">
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white border-2 border-brand-600 shadow-md flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-brand-700">03</span>
                </div>
                {/* Card - Left on desktop */}
                <div className="ml-14 md:ml-0 md:w-1/2 md:pr-14">
                  <div className="proton-card p-6 bg-slate-50/70 hover:bg-white transition-all border-slate-200">
                    <div className="flex items-center gap-2.5 text-brand-600 mb-2">
                      <FileText size={18} />
                      <span className="proton-micro-label">STAGE 03 &bull; DRAFT</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Draft</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      AI generates structured clinical documentation from the consultation.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>SOAP Formatting</span> &bull; <span>Prescription Proposals</span>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block md:w-1/2" />
              </div>

              {/* Stage 04: VERIFY */}
              <div className="relative flex flex-col md:flex-row items-start md:items-center">
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-amber-50 border-2 border-amber-600 shadow-md flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-amber-800">04</span>
                </div>
                <div className="hidden md:block md:w-1/2" />
                {/* Card - Right on desktop */}
                <div className="ml-14 md:ml-0 md:w-1/2 md:pl-14">
                  <div className="proton-card p-6 bg-amber-50/40 hover:bg-white transition-all border-amber-200">
                    <div className="flex items-center gap-2.5 text-amber-700 mb-2">
                      <ShieldCheck size={18} />
                      <span className="proton-micro-label text-amber-800">STAGE 04 &bull; VERIFY (SAFETY GATE)</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Verify</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      Deterministic checks identify missing or potentially conflicting information.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 font-mono">
                      <span>Allergy Cross-check</span> &bull; <span>Dosage Sanity</span> &bull; <span>FHIR Validation</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 05: REVIEW */}
              <div className="relative flex flex-col md:flex-row items-start md:items-center">
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white border-2 border-brand-600 shadow-md flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-brand-700">05</span>
                </div>
                {/* Card - Left on desktop */}
                <div className="ml-14 md:ml-0 md:w-1/2 md:pr-14">
                  <div className="proton-card p-6 bg-slate-50/70 hover:bg-white transition-all border-slate-200">
                    <div className="flex items-center gap-2.5 text-brand-600 mb-2">
                      <Eye size={18} />
                      <span className="proton-micro-label">STAGE 05 &bull; REVIEW</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Review</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      The physician reviews every AI-generated suggestion with full provenance.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>Source Quotes</span> &bull; <span>Confidence Ratings</span> &bull; <span>Inline Editing</span>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block md:w-1/2" />
              </div>

              {/* Stage 06: APPROVE */}
              <div className="relative flex flex-col md:flex-row items-start md:items-center">
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-emerald-50 border-2 border-emerald-600 shadow-md flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-emerald-800">06</span>
                </div>
                <div className="hidden md:block md:w-1/2" />
                {/* Card - Right on desktop */}
                <div className="ml-14 md:ml-0 md:w-1/2 md:pl-14">
                  <div className="proton-card p-6 bg-emerald-50/40 hover:bg-white transition-all border-emerald-200">
                    <div className="flex items-center gap-2.5 text-emerald-700 mb-2">
                      <CheckCircle2 size={18} />
                      <span className="proton-micro-label text-emerald-800">STAGE 06 &bull; APPROVE (PHYSICIAN AUTHORITY)</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Approve</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      Nothing clinically meaningful becomes authoritative without physician sign-off.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 font-mono">
                      <span>Cryptographic Signature</span> &bull; <span>Licensed Responsibility</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage 07: REMEMBER */}
              <div className="relative flex flex-col md:flex-row items-start md:items-center">
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white border-2 border-brand-600 shadow-md flex items-center justify-center z-10">
                  <span className="text-xs font-mono font-bold text-brand-700">07</span>
                </div>
                {/* Card - Left on desktop */}
                <div className="ml-14 md:ml-0 md:w-1/2 md:pr-14">
                  <div className="proton-card p-6 bg-slate-50/70 hover:bg-white transition-all border-slate-200">
                    <div className="flex items-center gap-2.5 text-brand-600 mb-2">
                      <Database size={18} />
                      <span className="proton-micro-label">STAGE 07 &bull; REMEMBER</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Remember</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      Approved information becomes part of the longitudinal patient story.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>Longitudinal Memory</span> &bull; <span>Cross-encounter Context</span>
                    </div>
                  </div>
                </div>
                <div className="hidden md:block md:w-1/2" />
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 6. WHAT MATTERS TODAY SECTION ─────────────────────────────── */}
      <section id="clinical-intelligence" className="bg-slate-50 py-24 sm:py-32 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl">
            <div className="proton-micro-label text-brand-600 mb-3 tracking-widest">
              PRE-CONSULTATION SYNTHESIS
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              What does this physician need to know today?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Before the door opens, Proton scans the patient&apos;s full chronological record, recent diagnostic tests, and unresolved action items to extract the essential facts that dictate today&apos;s consultation strategy.
            </p>
          </div>

          {/* Premium Mockup of the What Matters Today Interface */}
          <div className="mt-14 max-w-4xl mx-auto">
            <div className="proton-card bg-white border border-slate-200 shadow-xl overflow-hidden rounded-2xl">
              
              {/* Interface Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                    EV
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Eleanor Vance</span>
                      <span className="text-xs text-slate-400">68y &bull; Female</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        MRN: PT-84920
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Primary Diagnosis: Type 2 Diabetes &bull; Essential Hypertension
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Consultation Briefing Ready
                  </span>
                </div>
              </div>

              {/* Interface Content: 4 Items with Numbering & Provenance */}
              <div className="p-6 sm:p-8 divide-y divide-slate-100 space-y-6">
                
                {/* Item 1: Penicillin allergy */}
                <div className="pt-2 first:pt-0">
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-700 font-mono font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      01
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">Penicillin allergy</h4>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            Critical Alert
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                          Source: AllergyIntolerance &bull; Active
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                        Documented anaphylactic reaction (urticaria and bronchospasm) to amoxicillin. Cephalosporin cross-reactivity caution recommended.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Item 2: HbA1c increased */}
                <div className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 font-mono font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      02
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">HbA1c increased</h4>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Biomarker Trend
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                          7.1% &rarr; 8.2%, Source: Observation &bull; 12 Oct 2026
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                        Elevated from 7.1% to 8.2% over 6 months despite prescribed Metformin 1000mg BID. Fasting glucose averaged 164 mg/dL.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Item 3: Medication change */}
                <div className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-lg bg-brand-100 text-brand-800 font-mono font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      03
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">Medication change</h4>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                            Pharmacotherapy Event
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                          Metformin dose adjustment, Source: Previous consultation &bull; 04 Sep 2026
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                        Metformin dose adjustment: increased from 500mg daily to 1000mg BID following nephrology review (eGFR stable at 68 mL/min).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Item 4: Follow-up required */}
                <div className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-800 font-mono font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      04
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">Follow-up required</h4>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Clinical Action Item
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                          Adherence concern unresolved, Source: Clinical note &bull; 04 Sep 2026
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                        Adherence concern unresolved: Patient reported GI disturbance with higher dose. Confirm actual daily intake and GI tolerance today.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Interface Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Full FHIR resource provenance verifiable by clinician</span>
                </div>
                <div className="text-slate-400">
                  Ready for today&apos;s encounter &bull; Time saved: ~14 minutes
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── 7. USE CASES SECTION ──────────────────────────────────────── */}
      <section id="for-physicians" className="bg-white py-24 sm:py-32 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto">
            <div className="proton-micro-label text-brand-600 mb-3 tracking-widest">
              CLINICAL WORKFLOW INTEGRATION
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              Built around the physician workflow
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Designed from the clinical bedside up to reduce cognitive load, accelerate documentation, and keep the doctor fully focused on patient care.
            </p>
          </div>

          {/* 3 Use Case Cards */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Use Case 1: Pre-Consultation Intelligence */}
            <div className="proton-card p-8 bg-slate-50/50 hover:bg-white transition-all border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold tracking-wider text-brand-600 bg-brand-50 px-2.5 py-1 rounded border border-brand-200">
                  01 &bull; PRE-VISIT
                </span>
                <h3 className="mt-6 text-xl font-bold text-slate-900">
                  Pre-Consultation Intelligence
                </h3>
                <div className="mt-1 text-sm font-semibold text-brand-700">
                  Know what matters before you walk in
                </div>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                  Spend 30 seconds instead of 15 minutes reviewing records. Proton synthesizes past consultations, lab panels, outside faxes, and medication shifts into a high-yield clinical brief.
                </p>

                <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-200 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Instant high-yield summary of past visits and labs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Active contraindication and allergy alerts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Unresolved follow-up tracking</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center text-xs font-medium text-brand-700">
                <span>Optimized for fast chart review</span>
              </div>
            </div>

            {/* Use Case 2: Consultation Documentation */}
            <div className="proton-card p-8 bg-slate-50/50 hover:bg-white transition-all border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold tracking-wider text-brand-600 bg-brand-50 px-2.5 py-1 rounded border border-brand-200">
                  02 &bull; IN-VISIT
                </span>
                <h3 className="mt-6 text-xl font-bold text-slate-900">
                  Consultation Documentation
                </h3>
                <div className="mt-1 text-sm font-semibold text-brand-700">
                  AI drafts. You decide.
                </div>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                  Focus your eyes on the patient instead of keyboard screens. Ambient capture creates structured SOAP notes, prescription suggestions, and patient instructions in real time.
                </p>

                <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-200 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Ambient consultation dialogue capture</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Multi-format SOAP &amp; General consultation drafting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Physician edits and approves every line</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center text-xs font-medium text-brand-700">
                <span>Eliminates pajama time charting</span>
              </div>
            </div>

            {/* Use Case 3: Longitudinal Memory */}
            <div className="proton-card p-8 bg-slate-50/50 hover:bg-white transition-all border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold tracking-wider text-brand-600 bg-brand-50 px-2.5 py-1 rounded border border-brand-200">
                  03 &bull; POST-VISIT &amp; TRAJECTORY
                </span>
                <h3 className="mt-6 text-xl font-bold text-slate-900">
                  Longitudinal Memory
                </h3>
                <div className="mt-1 text-sm font-semibold text-brand-700">
                  One patient. One clinical story.
                </div>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                  Never lose continuity between encounters. Every approved consultation, uploaded document, and lab result automatically enriches the patient&apos;s unified longitudinal graph.
                </p>

                <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-200 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Unified chronological health narrative</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Cross-encounter medication titration history</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Automatic adherence and question carryover</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center text-xs font-medium text-brand-700">
                <span>Preserves clinical continuity</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8. PRODUCT PHILOSOPHY SECTION ─────────────────────────────── */}
      <section className="bg-slate-950 py-24 sm:py-32 text-white relative overflow-hidden border-b border-slate-800">
        {/* Subtle grid background */}
        <div className="absolute inset-0 proton-grid-pattern opacity-60 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-600/10 rounded-full blur-[130px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold mb-6">
              <Lock size={12} className="text-brand-400" />
              <span>CLINICAL ETHICS &amp; GOVERNANCE</span>
            </div>

            {/* Large quote */}
            <blockquote className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              &ldquo;AI should reduce cognitive load, not replace clinical judgment.&rdquo;
            </blockquote>
            <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              We reject the premise of autonomous clinical AI. In Proton, artificial intelligence operates strictly as a subordinate drafting assistant under licensed medical authority.
            </p>
          </div>

          {/* 4 Principles in 2x2 Grid */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            
            {/* Principle 1 */}
            <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-xs font-mono font-bold text-brand-400 mb-2">PRINCIPLE 01</div>
              <h3 className="text-xl font-bold text-white">
                AI drafts. Physicians decide.
              </h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                No note, prescription order, or diagnostic impression is ever committed to the official record without explicit, conscious physician confirmation.
              </p>
            </div>

            {/* Principle 2 */}
            <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-xs font-mono font-bold text-brand-400 mb-2">PRINCIPLE 02</div>
              <h3 className="text-xl font-bold text-white">
                AI remembers. Physicians approve.
              </h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Longitudinal memory organizes complex chronologies across years, but what enters permanent clinical truth requires physician validation.
              </p>
            </div>

            {/* Principle 3 */}
            <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-xs font-mono font-bold text-brand-400 mb-2">PRINCIPLE 03</div>
              <h3 className="text-xl font-bold text-white">
                AI surfaces. Physicians interpret.
              </h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Proton detects lab anomalies and drug titration patterns with verifiable citations, leaving clinical etiology and significance to the doctor.
              </p>
            </div>

            {/* Principle 4 */}
            <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-xs font-mono font-bold text-brand-400 mb-2">PRINCIPLE 04</div>
              <h3 className="text-xl font-bold text-white">
                AI verifies structure. Physicians own the decision.
              </h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Deterministic algorithmic guards flag missing fields and known allergy conflicts, while the physician retains full legal and clinical ownership.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── 9. CTA SECTION ────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 py-24 sm:py-32 text-white text-center relative border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="h-14 w-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-600/30">
            <Activity size={28} className="stroke-[2.5]" />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Experience Proton
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            See how clinical intelligence transforms the physician workflow.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="proton-btn proton-btn-primary px-8 py-4 text-base font-semibold rounded-xl flex items-center gap-2.5 shadow-xl shadow-brand-600/30 hover:shadow-brand-600/50 cursor-pointer w-full sm:w-auto"
            >
              <span>Enter Physician Workspace</span>
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="mt-6 text-xs text-slate-400 font-mono">
            Controlled Synthetic Evaluation Environment
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 pt-8 border-t border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              Synthetic Patient Evaluation Cohort
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              Full Provenance Audit Trail
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-400" />
              Physician-in-the-Loop Safeguards
            </span>
          </div>

        </div>
      </section>

      {/* ── 10. FOOTER ────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-16 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-12 border-b border-slate-800">
            {/* Logo and Tagline */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-brand-600 text-white rounded-lg flex items-center justify-center shadow-xs">
                  <Activity size={18} className="stroke-[2.5]" />
                </div>
                <span className="font-bold text-lg text-white tracking-tight">PROTON</span>
              </div>
              <p className="mt-2 text-xs text-slate-400 max-w-sm">
                AI Clinical Copilot for Physicians &bull; Intelligent ambient documentation, What Matters Today synthesis, and longitudinal memory.
              </p>
            </div>

            {/* Nav Links */}
            <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-300">
              <button 
                onClick={() => scrollToSection('how-it-works')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                How Proton Works
              </button>
              <button 
                onClick={() => scrollToSection('clinical-intelligence')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Clinical Intelligence
              </button>
              <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Documentation
              </button>
              <button 
                onClick={() => scrollToSection('for-physicians')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                For Physicians
              </button>
            </div>
          </div>

          {/* Legal / Evaluation Disclaimers */}
          <div className="mt-8 pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              Controlled Synthetic Evaluation Environment &bull; Designed for practicing physicians
            </div>
            <div className="text-slate-400 text-[11px] leading-relaxed max-w-xl text-left md:text-right">
              Proton is deployed for evaluation with synthetic test patients. This is not a certified medical device.
            </div>
          </div>

          <div className="mt-6 text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} Proton Clinical Intelligence. All rights reserved. Evaluation Beta.
          </div>

        </div>
      </footer>

    </div>
  );
}
