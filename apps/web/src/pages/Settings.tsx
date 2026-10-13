import { ShieldCheck, Cpu, User, Keyboard, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';

export default function Settings() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 proton-animate-in">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Settings & Clinical Policies</h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Physician operating preferences, AI copilot parameters, and deterministic safety enforcement.
          </p>
        </div>

        {/* Section 1: Physician Identity */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="h-8 w-8 bg-brand-50 text-brand-700 rounded-lg flex items-center justify-center">
              <User size={16} />
            </div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Physician Identity & Authority</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)] block">Treating Clinician</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">Dr. Alex Morgan, MD</span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">Internal & Ambulatory Medicine</span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)] block">Clinical Role</span>
              <span className="text-emerald-700 font-bold text-sm mt-1 block">Attending Physician (Final Authority)</span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">Exclusive authority to sign notes & orders</span>
            </div>
          </div>
        </div>

        {/* Section 2: AI Copilot Engine Status */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="h-8 w-8 bg-violet-50 text-violet-700 rounded-lg flex items-center justify-center">
              <Cpu size={16} />
            </div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">AI Clinical Engine & Provider</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-violet-50/50 rounded-xl border border-violet-200/60">
              <span className="proton-micro-label text-violet-600">Active Model</span>
              <span className="text-violet-900 font-bold text-sm mt-1 block">Gemini 3.5 Flash</span>
              <span className="text-violet-600 text-[11px] mt-0.5 block">Google Gen AI SDK v2</span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Sampling Temperature</span>
              <span className="text-[var(--color-text-primary)] font-mono font-bold text-sm mt-1 block">0.0 (Deterministic)</span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">Maximized grounding</span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Fallback Mode</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">Demo Fixtures</span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">Deterministic backup</span>
            </div>
          </div>
        </div>

        {/* Section 3: Safety Gating Rules */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="h-8 w-8 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Deterministic Safety Enforcement</h2>
          </div>
          <div className="space-y-0">
            {[
              { title: 'Zero Silent FHIR Writes', desc: 'No clinical data is written without explicit physician sign-off.' },
              { title: 'Mandatory 5-Field Prescription Validation', desc: 'Blocks approval if Drug, Strength, Dose, Route, or Duration is omitted.' },
              { title: 'Allergy & Contraindication Cross-Referencing', desc: 'Detects penicillin/NSAID conflicts against documented clinical history.' },
              { title: 'Review Center Fact Isolation', desc: 'Extracted facts from documents remain in staging until approved.' },
            ].map((item, i) => (
              <div key={i} className="py-3 flex items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] last:border-0">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <span className="proton-micro-label px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 shrink-0">Enforced</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Keyboard Shortcuts */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="h-8 w-8 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] rounded-lg flex items-center justify-center">
              <Keyboard size={16} />
            </div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Keyboard Shortcuts</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Command Palette', key: '⌘K' },
              { label: 'Focus Search', key: '/' },
              { label: 'Dismiss', key: 'ESC' },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)] flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">{item.label}</span>
                <span className="proton-kbd">{item.key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Synthetic Beta Disclaimer */}
        <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Synthetic Beta Environment</h4>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Proton V1 is deployed exclusively for controlled physician evaluation using synthetic clinical data.
              Real protected health information (PHI) must never be entered into this environment.
            </p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
