import { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, User, Keyboard, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Layout from '../components/Layout';
import { API_BASE_URL } from '../config';

interface AIHealthStatus {
  provider: string;
  mode: string;
  model: string;
  configured: boolean;
  reachable?: boolean;
}

export default function Settings() {
  const [aiStatus, setAiStatus] = useState<AIHealthStatus | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health/ai`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setAiStatus(data);
      })
      .catch(() => {});
  }, []);

  const providerDisplay = aiStatus?.provider === 'medgemma'
    ? 'MedGemma Local'
    : aiStatus?.provider === 'deepseek'
    ? 'DeepSeek (Beta)'
    : aiStatus?.provider === 'grok'
    ? 'xAI Grok'
    : aiStatus?.provider === 'gemini'
    ? 'Gemini (Cloud)'
    : 'Demo Fixtures';

  const modelDisplay = aiStatus?.model || 'google/medgemma-1.5-4b-it';
  const isMedGemma = aiStatus?.provider === 'medgemma';

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
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-violet-50 text-violet-700 rounded-lg flex items-center justify-center">
                <Cpu size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">AI Clinical Engine & Provider</h2>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">Provider: {providerDisplay}</p>
              </div>
            </div>
            {isMedGemma && (
              <span className="proton-micro-label px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                Local AI • MedGemma 1.5 4B
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-violet-50/50 rounded-xl border border-violet-200/60">
              <span className="proton-micro-label text-violet-600">Active Model</span>
              <span className="text-violet-900 font-bold text-sm mt-1 block truncate" title={modelDisplay}>
                {modelDisplay}
              </span>
              <span className="text-violet-600 text-[11px] mt-0.5 block">
                {isMedGemma ? 'Local vLLM Inference' : 'Google Gen AI SDK v2'}
              </span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Environment Mode</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">
                {aiStatus?.mode ? aiStatus.mode.toUpperCase() : 'LOCAL'}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">
                {isMedGemma ? (aiStatus?.reachable ? '● Local Server Online' : '○ Local Server Offline') : 'Connected'}
              </span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Clinical Safety Boundary</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">Physician Review Required</span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">Zero autonomous FHIR writes</span>
            </div>
          </div>
          {isMedGemma && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span>Development Notice: MedGemma is running as a local experimental medical model. Technical evaluation only &bull; Not clinically validated.</span>
            </div>
          )}
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
