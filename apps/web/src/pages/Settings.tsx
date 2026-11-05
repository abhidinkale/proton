import { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, User, Keyboard, AlertTriangle, CheckCircle2, LayoutTemplate, SlidersHorizontal, LoaderCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/api';
import { clinicApi, type ClinicAuditEvent, type ClinicPreferences } from '../lib/clinicApi';
import { applyAppearance } from '../design-system/theme/palettes';
import { authService } from '../services/auth';

interface AIHealthStatus {
  provider: string;
  mode: string;
  model: string;
  configured: boolean;
  reachable?: boolean;
}

export default function Settings() {
  const [aiStatus, setAiStatus] = useState<AIHealthStatus | null>(null);
  const [aiStatusState, setAiStatusState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [preferences, setPreferences] = useState<ClinicPreferences | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [auditEvents, setAuditEvents] = useState<ClinicAuditEvent[]>([]);
  const [auditVerification, setAuditVerification] = useState<{ valid: boolean; totalEventsVerified: number; headHash: string | null } | null>(null);
  const [auditState, setAuditState] = useState<'idle' | 'loading' | 'error'>('idle');

  const currentUser = authService.getCurrentUser();

  const loadAudit = () => {
    setAuditState('loading');
    Promise.all([clinicApi.listAudit(25), clinicApi.verifyAudit()])
      .then(([list, verification]) => {
        setAuditEvents(list.events);
        setAuditVerification(verification);
        setAuditState('idle');
      })
      .catch(() => setAuditState('error'));
  };

  useEffect(() => {
    loadAudit();
  }, []);

  useEffect(() => {
    clinicApi
      .getPreferences()
      .then((result) => setPreferences(result.preferences))
      .catch((error) => setPreferencesError((error as Error).message || 'Could not load preferences.'));
  }, []);

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/health/ai`)
      .then(res => {
        if (!res.ok) throw new Error(`AI status request failed (${res.status})`);
        return res.json();
      })
      .then(data => {
        setAiStatus(data);
        setAiStatusState('ready');
      })
      .catch(error => {
        console.error('Unable to load AI provider status:', error);
        setAiStatusState('unavailable');
      });
  }, []);

  const updatePreference = <K extends keyof ClinicPreferences>(key: K, value: ClinicPreferences[K]) => {
    setPreferencesSaved(false);
    setPreferences((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      // Appearance and motion apply immediately; the save button persists them.
      if (key === 'appearance') {
        const appearance = value as ClinicPreferences['appearance'];
        localStorage.setItem('proton_appearance', appearance);
        applyAppearance(appearance);
      }
      if (key === 'density') {
        document.documentElement.dataset.density = String(value);
      }
      if (key === 'reduceMotion') {
        document.documentElement.dataset.reduceMotion = String(value);
      }
      return next;
    });
  };

  const savePreferences = async () => {
    if (!preferences) return;
    setIsSavingPreferences(true);
    setPreferencesError(null);
    try {
      const result = await clinicApi.updatePreferences(preferences);
      setPreferences(result.preferences);
      setPreferencesSaved(true);
      window.setTimeout(() => setPreferencesSaved(false), 2600);
    } catch (error) {
      setPreferencesError((error as Error).message || 'Could not save preferences.');
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const providerDisplay = aiStatus?.provider === 'medgemma'
    ? 'MedGemma Local'
    : aiStatus?.provider === 'deepseek'
    ? 'DeepSeek (Beta)'
    : aiStatus?.provider === 'grok'
    ? 'xAI Grok'
    : aiStatus?.provider === 'gemini'
    ? 'Gemini (Cloud)'
    : aiStatusState === 'loading'
      ? 'Checking connection'
      : aiStatusState === 'unavailable'
        ? 'Status unavailable'
        : 'Demo Fixtures';

  const modelDisplay = aiStatus?.model || (aiStatusState === 'loading' ? 'Checking provider…' : 'Not available');
  const isMedGemma = aiStatus?.provider === 'medgemma';
  const providerDescription = aiStatus?.provider === 'medgemma'
    ? 'Local inference server'
    : aiStatus?.provider === 'gemini'
      ? 'Google Gen AI SDK'
      : aiStatus?.provider
        ? `${aiStatus.provider} API`
        : aiStatusState === 'loading'
          ? 'Checking provider connection'
          : 'Provider details unavailable';
  const isClassicLayout = localStorage.getItem('proton_workspace_ui') === 'classic';

  const switchLayout = () => {
    localStorage.setItem('proton_workspace_ui', isClassicLayout ? 'premium' : 'classic');
    window.location.reload();
  };

  return (
    <Layout>
      <div className="proton-settings-page max-w-3xl mx-auto space-y-6 proton-animate-in">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Settings & Clinical Policies</h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Physician preferences, language model settings, and clinical safety controls.
          </p>
        </div>

        {/* Hospital & Clinic Appliance Reconfiguration Card */}
        <div className="proton-card flex flex-wrap items-center justify-between gap-4 p-5 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
              <SlidersHorizontal size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Hospital Appliance Configuration</h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-500">ON-PREM</span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                Configure clinic identity, NPI number, embedded vs enterprise database, and Gemini AI credentials.
              </p>
            </div>
          </div>
          <a
            href="/setup"
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-xs"
          >
            Run Setup Wizard
          </a>
        </div>

        <div className="proton-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
              <LayoutTemplate size={17} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Workspace layout</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                {isClassicLayout ? 'Classic layout is active.' : 'Proton workspace is active.'}
              </p>
            </div>
          </div>
          <button type="button" className="clinical-btn-secondary" onClick={switchLayout}>
            {isClassicLayout ? 'Return to Proton workspace' : 'Use classic layout'}
          </button>
        </div>

        {/* Section: Working preferences (persisted) */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] rounded-lg flex items-center justify-center">
                <SlidersHorizontal size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Working preferences</h2>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">Stored per clinician on the clinic server.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { void savePreferences(); }}
              disabled={!preferences || isSavingPreferences}
              className="inline-flex items-center gap-1.5 rounded-full bg-solid px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-solid disabled:opacity-50 cursor-pointer"
            >
              {isSavingPreferences && <LoaderCircle size={12} className="animate-spin" />}
              {isSavingPreferences ? 'Saving…' : preferencesSaved ? 'Saved' : 'Save preferences'}
            </button>
          </div>

          {preferencesError && (
            <p className="rounded-xl border border-caution-line bg-caution-wash px-3 py-2 text-[11px] text-caution">{preferencesError}</p>
          )}

          {!preferences ? (
            <p className="text-[11.5px] text-[var(--color-text-tertiary)]">Loading preferences…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="proton-micro-label text-[var(--color-text-tertiary)] block mb-1.5">Appearance</label>
                <div className="flex items-center rounded-full bg-[var(--color-surface-sunken)] p-1 text-[11px] font-semibold">
                  {(['system', 'light', 'dark'] as const).map((appearance) => (
                    <button
                      key={appearance}
                      type="button"
                      onClick={() => updatePreference('appearance', appearance)}
                      className={`flex-1 rounded-full px-2 py-1.5 capitalize transition-colors cursor-pointer ${
                        preferences.appearance === appearance
                          ? 'bg-paper text-ink shadow-xs'
                          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {appearance}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="proton-micro-label text-[var(--color-text-tertiary)] block mb-1.5">Density</label>
                <div className="flex items-center rounded-full bg-[var(--color-surface-sunken)] p-1 text-[11px] font-semibold">
                  {(['comfortable', 'compact'] as const).map((density) => (
                    <button
                      key={density}
                      type="button"
                      onClick={() => updatePreference('density', density)}
                      className={`flex-1 rounded-full px-2 py-1.5 capitalize transition-colors cursor-pointer ${
                        preferences.density === density
                          ? 'bg-paper text-ink shadow-xs'
                          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="proton-micro-label text-[var(--color-text-tertiary)] block mb-1.5">Default note template</label>
                <select
                  value={preferences.defaultNoteTemplate}
                  onChange={(event) => updatePreference('defaultNoteTemplate', event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3 py-2 text-[12px] focus:outline-none"
                >
                  <option value="SOAP">SOAP: Subjective, Objective, Assessment, Plan</option>
                  <option value="HPI">HPI: History of present illness</option>
                  <option value="Progress">Progress note</option>
                  <option value="Consult">Consultation note</option>
                </select>
              </div>

              {[
                {
                  key: 'notificationsEnabled' as const,
                  title: 'Clinical notifications',
                  description: 'Show the attention queue badge for lab escalations and unsigned notes.'
                },
                {
                  key: 'reduceMotion' as const,
                  title: 'Reduce motion',
                  description: 'Disable page and card animation throughout the workspace.'
                },
                {
                  key: 'showSyntheticBanner' as const,
                  title: 'Synthetic data banner',
                  description: 'Keep the evaluation-environment reminder visible.'
                }
              ].map((entry) => (
                <label
                  key={entry.key}
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3 sm:col-span-2"
                >
                  <span>
                    <span className="block text-[12px] font-semibold text-[var(--color-text-primary)]">{entry.title}</span>
                    <span className="mt-0.5 block text-[10.5px] leading-relaxed text-[var(--color-text-tertiary)]">{entry.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences[entry.key])}
                    onChange={(event) => updatePreference(entry.key, event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-border-default)]"
                  />
                </label>
              ))}
            </div>
          )}
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
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">
                {currentUser?.displayName || 'Not signed in'}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">
                {currentUser?.email || 'No session'}
              </span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)] block">Clinical Role</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">
                {currentUser?.role
                  ? currentUser.role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
                  : 'Unassigned'}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">
                {currentUser?.npi ? `NPI ${currentUser.npi}` : 'NPI not on session'} · {currentUser?.organizationId || 'no tenant'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Clinical language model */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] rounded-lg flex items-center justify-center">
                <Cpu size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Clinical language model</h2>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">Provider: {providerDisplay}</p>
              </div>
            </div>
            {isMedGemma && (
              <span className="proton-micro-label px-2 py-0.5 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded">
                Local model • MedGemma 1.5 4B
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Active Model</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block truncate" title={modelDisplay}>
                {modelDisplay}
              </span>
              <span className="text-[var(--color-text-secondary)] text-[11px] mt-0.5 block">
                {providerDescription}
              </span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Environment Mode</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">
                {aiStatus?.mode
                  ? aiStatus.mode.toUpperCase()
                  : aiStatusState === 'loading'
                    ? 'CHECKING'
                    : 'UNAVAILABLE'}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">
                {isMedGemma
                  ? (aiStatus?.reachable ? 'Local server online' : 'Local server offline')
                  : aiStatus?.configured
                    ? 'Provider configured'
                    : aiStatusState === 'ready'
                      ? 'Provider not configured'
                      : 'Connection not confirmed'}
              </span>
            </div>
            <div className="p-4 bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border-subtle)]">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Clinical Safety Boundary</span>
              <span className="text-[var(--color-text-primary)] font-bold text-sm mt-1 block">Physician Review Required</span>
              <span className="text-[var(--color-text-tertiary)] text-[11px] mt-0.5 block">Zero autonomous FHIR writes</span>
            </div>
          </div>
          {isMedGemma && (
            <div className="p-3 bg-[var(--color-surface-raised)] rounded-lg border border-[var(--color-border-default)] text-[11px] text-[var(--color-text-secondary)] flex items-center gap-2">
              <AlertTriangle size={14} className="text-caution shrink-0" />
              <span>Development Notice: MedGemma is running as a local experimental medical model. Technical evaluation only &bull; Not clinically validated.</span>
            </div>
          )}
          {aiStatusState === 'unavailable' && (
            <p className="text-xs text-[var(--color-text-secondary)]" role="status">
              Provider status could not be loaded. Check the API service connection.
            </p>
          )}
        </div>

        {/* Section 3: Safety Gating Rules */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="h-8 w-8 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] rounded-lg flex items-center justify-center">
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
                  <CheckCircle2 size={16} className="text-[var(--color-text-secondary)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <span className="proton-micro-label px-2 py-0.5 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] rounded border border-[var(--color-border-default)] shrink-0">Enforced</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Audit trail */}
        <div className="proton-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] rounded-lg flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Hash-chained audit trail</h2>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  Every clinic write is appended with a SHA-256 link to the previous event.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadAudit}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              {auditState === 'loading' && <LoaderCircle size={12} className="animate-spin" />}
              Verify chain
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
              auditVerification?.valid
                ? 'bg-settled-wash text-settled'
                : auditVerification
                  ? 'bg-critical-wash text-critical'
                  : 'bg-[var(--color-surface-sunken)] text-[var(--color-text-tertiary)]'
            }`}>
              <CheckCircle2 size={12} />
              {auditState === 'error'
                ? 'Verification unavailable'
                : auditVerification
                  ? auditVerification.valid
                    ? `Chain valid · ${auditVerification.totalEventsVerified} events`
                    : 'Chain integrity failure'
                  : 'Not verified yet'}
            </span>
            {auditVerification?.headHash && (
              <span className="truncate font-mono text-[10px] text-[var(--color-text-tertiary)]">
                head {auditVerification.headHash.slice(0, 24)}…
              </span>
            )}
          </div>

          <div className="max-h-64 divide-y divide-[var(--color-border-subtle)] overflow-y-auto">
            {auditEvents.length === 0 && auditState !== 'loading' && (
              <p className="py-4 text-[11.5px] text-[var(--color-text-tertiary)]">No audit events yet.</p>
            )}
            {auditEvents.map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[11.5px] font-semibold text-[var(--color-text-primary)]">{event.summary}</p>
                  <p className="mt-0.5 font-mono text-[9.5px] text-[var(--color-text-tertiary)]">
                    {event.action} · {event.actorName || 'system'} · {new Date(event.at).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[9px] text-[var(--color-text-tertiary)]">
                  {event.hash.slice(0, 10)}…
                </span>
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
        <div className="bg-caution-wash/70 border border-caution-line/60 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-caution shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-caution text-sm">Synthetic Beta Environment</h4>
            <p className="mt-1 text-xs leading-relaxed text-caution">
              Proton V1 is deployed exclusively for controlled physician evaluation using synthetic clinical data.
              Real protected health information (PHI) must never be entered into this environment.
            </p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
