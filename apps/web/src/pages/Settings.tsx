import { ShieldCheck, Cpu, User, Keyboard, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout';

export default function Settings() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 py-2">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Proton Clinical OS &bull; Configuration & Safety Controls
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Settings & Clinical Policies
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Physician operating preferences, AI copilot parameters, and deterministic safety enforcement.
          </p>
        </div>

        {/* Section 1: Physician Identity */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <User size={18} className="text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">Physician Identity & Authority</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Treating Clinician</span>
              <span className="text-slate-900 font-bold text-sm mt-0.5 block">Dr. Alex Morgan, MD</span>
              <span className="text-slate-500 text-[11px] mt-0.5 block">Internal & Ambulatory Medicine</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Clinical Role</span>
              <span className="text-emerald-700 font-bold text-sm mt-0.5 block">Attending Physician (Final Authority)</span>
              <span className="text-slate-500 text-[11px] mt-0.5 block">Exclusive authority to sign notes & orders</span>
            </div>
          </div>
        </div>

        {/* Section 2: AI Copilot Engine Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Cpu size={18} className="text-purple-600" />
            <h2 className="text-base font-bold text-slate-900">AI Clinical Engine & Provider</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200">
              <span className="text-purple-900 font-semibold uppercase tracking-wider text-[10px]">Active Model</span>
              <span className="text-purple-950 font-bold text-sm mt-0.5 block">Gemini 3.5 Flash</span>
              <span className="text-purple-800 text-[11px] mt-0.5 block">Google Gen AI SDK v2</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Sampling Temperature</span>
              <span className="text-slate-900 font-mono font-bold text-sm mt-0.5 block">0.0 (Deterministic)</span>
              <span className="text-slate-500 text-[11px] mt-0.5 block">Maximized grounding & zero creativity</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Fallback Mode</span>
              <span className="text-slate-900 font-bold text-sm mt-0.5 block">Demo Fixtures</span>
              <span className="text-slate-500 text-[11px] mt-0.5 block">Deterministic mock backup</span>
            </div>
          </div>
        </div>

        {/* Section 3: Safety Gating Rules */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <ShieldCheck size={18} className="text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Deterministic Safety Enforcement</h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Zero Silent FHIR Writes</p>
                <p className="text-slate-500 text-[11px]">No clinical data is written without explicit physician sign-off.</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">Enforced</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Mandatory 5-Field Prescription Validation</p>
                <p className="text-slate-500 text-[11px]">Blocks approval if Drug, Strength, Dose, Route, or Duration is omitted.</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">Enforced</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Allergy & Contraindication Cross-Referencing</p>
                <p className="text-slate-500 text-[11px]">Detects penicillin/NSAID conflicts against documented clinical history.</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">Enforced</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Review Center Fact Isolation</p>
                <p className="text-slate-500 text-[11px]">Extracted facts from documents remain in staging until approved.</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">Enforced</span>
            </div>
          </div>
        </div>

        {/* Section 4: Keyboard Shortcuts */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Keyboard size={18} className="text-slate-600" />
            <h2 className="text-base font-bold text-slate-900">Keyboard Shortcuts Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-slate-700 font-medium">Command Palette</span>
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-[11px] shadow-2xs font-semibold">⌘K / Ctrl+K</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-slate-700 font-medium">Focus Patient Search</span>
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-[11px] shadow-2xs font-semibold">/</kbd>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-slate-700 font-medium">Dismiss Modal / Search</span>
              <kbd className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-[11px] shadow-2xs font-semibold">ESC</kbd>
            </div>
          </div>
        </div>

        {/* Section 5: Synthetic Beta Disclaimer */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 flex items-start gap-3.5 text-xs text-amber-900">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-950">Synthetic Beta Environment Notice</h4>
            <p className="mt-1 leading-relaxed text-amber-900/90">
              Proton V1 is deployed exclusively for controlled physician evaluation using synthetic clinical data.
              Real protected health information (PHI) must never be entered into this environment.
            </p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
