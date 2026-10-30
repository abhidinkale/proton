import { useState, useEffect } from 'react';
import {
  X,
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  Pill,
  Activity,
  Stethoscope,
  Clock,
  Sparkles
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

export interface VitalDiff {
  metric: string;
  label: string;
  unit: string;
  prior: string | null;
  current: string | null;
  delta: number | null;
  trend: 'increased' | 'decreased' | 'unchanged' | 'newly_measured' | 'omitted' | 'not_comparable';
}

export interface MedicationDiff {
  drug: string;
  dose?: string;
  frequency?: string;
  prior?: { dose: string; frequency: string };
  current?: { dose: string; frequency: string };
  rationale?: string;
}

export interface EncounterComparisonData {
  tenantId: string;
  patientId: string;
  encounterA: string;
  encounterB: string;
  priorEncounter?: string | null;
  message?: string;
  diff: {
    chiefComplaint: {
      prior: string | null;
      current: string | null;
      changed: boolean;
    };
    vitals: VitalDiff[];
    diagnoses: {
      new: Array<{ condition: string; isPrimary: boolean; band?: string }>;
      ongoing: Array<{ condition: string; isPrimary: boolean; wasPrimary: boolean }>;
      resolved: Array<{ condition: string; isPrimary: boolean; band?: string }>;
    };
    medications: {
      added: MedicationDiff[];
      changed: MedicationDiff[];
      continued: MedicationDiff[];
      discontinued: MedicationDiff[];
    };
    examChanges: Array<{
      system: string;
      status: 'new' | 'changed' | 'resolved';
      prior?: string;
      current?: string;
    }>;
    treatmentEfficacy: Array<{
      conditionCode: string;
      label: string;
      followUpWave: string;
      assessedAt: string;
      patientReported: string | null;
      interpretedStatus: string;
    }>;
  };
}

interface EncounterComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  encounterId?: string;
  data?: EncounterComparisonData | null;
}

export default function EncounterComparisonModal({
  isOpen,
  onClose,
  patientId,
  patientName = 'Patient',
  encounterId,
  data: initialData
}: EncounterComparisonModalProps) {
  const [data, setData] = useState<EncounterComparisonData | null>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      return;
    }

    const url = encounterId
      ? `/api/workflow/encounters/${encounterId}/compare-previous`
      : patientId
      ? `/api/workflow/patients/${patientId}/encounters/compare`
      : null;

    if (isOpen && url) {
      setLoading(true);
      setError(null);
      apiFetch(url, {
        headers: { 'Content-Type': 'application/json' }
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Encounter comparison returned ${res.status}`);
          }
          return res.json();
        })
        .then((resData) => {
          setData(resData);
        })
        .catch((err) => {
          setError(err.message || 'Could not load encounter comparison');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, encounterId, patientId, initialData]);

  if (!isOpen) return null;

  const diff = data?.diff;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-surface-base border border-rule rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-elevated border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent-wash0/20 text-accent-ink border border-accent-line0/30">
              <GitCompare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink-1">Visit Comparison · What Changed Since Last Visit?</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-wider">
                  note_v1 Diff Engine
                </span>
              </div>
              <p className="text-xs text-ink-3 mt-0.5">
                Field-level schema diff for <span className="font-semibold text-ink-2">{patientName}</span> (prior vs current consultation)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink-1 hover:bg-paper/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
          {loading && (
            <div className="py-16 text-center text-ink-3">
              <Activity className="animate-spin mx-auto mb-2 text-accent-ink" size={24} />
              Computing structured schema diff across encounters...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-critical-wash0/15 border border-critical-line0/30 text-critical-on-solid flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && !diff && (
            <div className="py-12 text-center text-ink-3">
              <Clock size={28} className="mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-ink-2">No prior encounter recorded</p>
              <p className="text-[11px] mt-1">This is the first visit for this patient in the durable record.</p>
            </div>
          )}

          {!loading && diff && (
            <>
              {/* Prior Treatment Efficacy Banner */}
              {diff.treatmentEfficacy && diff.treatmentEfficacy.length > 0 && (
                <div className="p-4 rounded-xl bg-brand-950/40 border border-brand-500/30 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-brand-500/20 text-brand-300">
                    <Sparkles size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-brand-200 uppercase tracking-wider text-[11px]">
                        Prior Treatment Efficacy (30-Day Closed Loop)
                      </span>
                      <span className="text-[10px] text-brand-300/80">Validated in outcome cohort</span>
                    </div>
                    {diff.treatmentEfficacy.map((eff, i) => (
                      <div key={i} className="text-xs text-brand-100 mt-1 flex items-center gap-2">
                        <span className="font-semibold px-2 py-0.5 rounded bg-brand-500/20 border border-brand-500/30 text-[10px]">
                          {eff.interpretedStatus}
                        </span>
                        <span>
                          Prior treatment for condition {eff.conditionCode} evaluated as{' '}
                          <strong className="text-white capitalize">{eff.label}</strong> (wave {eff.followUpWave})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. Vitals Diff Grid */}
              <div>
                <h3 className="font-bold text-ink-1 uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-2.5">
                  <Activity size={14} className="text-accent-ink" />
                  Objective Vitals Trajectory
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {diff.vitals.map((v) => (
                    <div
                      key={v.metric}
                      className="p-3 rounded-xl bg-surface-elevated border border-rule flex flex-col justify-between"
                    >
                      <span className="text-[10px] text-ink-3 uppercase font-semibold">{v.label}</span>
                      <div className="mt-1 flex items-baseline justify-between">
                        <div>
                          <span className="text-sm font-bold text-ink-1">
                            {v.current ? `${v.current} ${v.unit}` : '—'}
                          </span>
                          {v.prior && (
                            <span className="text-[10px] text-ink-3 block">
                              Prior: {v.prior} {v.unit}
                            </span>
                          )}
                        </div>
                        {v.delta !== null && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                              v.delta > 0
                                ? 'bg-caution-wash0/20 text-caution-on-solid'
                                : v.delta < 0
                                ? 'bg-settled-wash0/20 text-settled-on-solid'
                                : 'bg-paper/10 text-ink-3'
                            }`}
                          >
                            {v.delta > 0 ? <TrendingUp size={10} /> : v.delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                            {v.delta > 0 ? `+${v.delta}` : v.delta}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Diagnoses Evolution */}
              <div>
                <h3 className="font-bold text-ink-1 uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-2.5">
                  <Stethoscope size={14} className="text-accent-ink" />
                  Diagnoses Evolution
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* New Diagnoses */}
                  <div className="p-3 rounded-xl bg-surface-elevated border border-rule">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-rule/30">
                      <span className="font-bold text-[11px] text-caution-on-solid flex items-center gap-1">
                        <AlertCircle size={12} /> New in this Encounter ({diff.diagnoses.new.length})
                      </span>
                    </div>
                    {diff.diagnoses.new.length === 0 ? (
                      <p className="text-[11px] text-ink-3 italic">None</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {diff.diagnoses.new.map((d, i) => (
                          <li key={i} className="text-[11px] font-semibold text-ink-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-caution-line0" />
                            {d.condition} {d.isPrimary && <span className="text-[9px] text-ink-3">(Primary)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Ongoing Diagnoses */}
                  <div className="p-3 rounded-xl bg-surface-elevated border border-rule">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-rule/30">
                      <span className="font-bold text-[11px] text-accent-ink flex items-center gap-1">
                        <Activity size={12} /> Ongoing / Chronic ({diff.diagnoses.ongoing.length})
                      </span>
                    </div>
                    {diff.diagnoses.ongoing.length === 0 ? (
                      <p className="text-[11px] text-ink-3 italic">None</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {diff.diagnoses.ongoing.map((d, i) => (
                          <li key={i} className="text-[11px] font-semibold text-ink-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-line0" />
                            {d.condition}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Resolved Diagnoses */}
                  <div className="p-3 rounded-xl bg-surface-elevated border border-rule">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-rule/30">
                      <span className="font-bold text-[11px] text-settled-on-solid flex items-center gap-1">
                        <CheckCircle2 size={12} /> Resolved Since Prior ({diff.diagnoses.resolved.length})
                      </span>
                    </div>
                    {diff.diagnoses.resolved.length === 0 ? (
                      <p className="text-[11px] text-ink-3 italic">None</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {diff.diagnoses.resolved.map((d, i) => (
                          <li key={i} className="text-[11px] font-semibold text-ink-2 line-through flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-settled-line0" />
                            {d.condition}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Medication Adjustments */}
              <div>
                <h3 className="font-bold text-ink-1 uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-2.5">
                  <Pill size={14} className="text-accent-ink" />
                  Prescription Regimen Revisions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Added / Changed */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated border border-rule">
                    <span className="font-bold text-[11px] text-ink-1 block mb-2">
                      Added or Adjusted Medications ({diff.medications.added.length + diff.medications.changed.length})
                    </span>
                    {diff.medications.added.length === 0 && diff.medications.changed.length === 0 ? (
                      <p className="text-[11px] text-ink-3 italic">No new medications or dose adjustments</p>
                    ) : (
                      <div className="space-y-2">
                        {diff.medications.added.map((m, i) => (
                          <div key={i} className="p-2 rounded-lg bg-caution-wash0/10 border border-caution-line0/20">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-ink-1">{m.drug}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-caution-wash0/30 text-caution-on-solid">
                                Newly Added
                              </span>
                            </div>
                            <span className="text-[10px] text-ink-3 block mt-0.5">
                              {m.dose} · {m.frequency}
                            </span>
                          </div>
                        ))}
                        {diff.medications.changed.map((m, i) => (
                          <div key={i} className="p-2 rounded-lg bg-accent-wash0/10 border border-accent-line0/20">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-ink-1">{m.drug}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-wash0/30 text-accent-ink">
                                Dosage Adjusted
                              </span>
                            </div>
                            <span className="text-[10px] text-ink-3 block mt-0.5">
                              Prior: {m.prior?.dose} ({m.prior?.frequency}) → Current: {m.current?.dose} ({m.current?.frequency})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Discontinued / Continued */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated border border-rule">
                    <span className="font-bold text-[11px] text-ink-1 block mb-2">
                      Maintained or Discontinued Regimen ({diff.medications.continued.length + diff.medications.discontinued.length})
                    </span>
                    <div className="space-y-2">
                      {diff.medications.discontinued.map((m, i) => (
                        <div key={i} className="p-2 rounded-lg bg-critical-wash0/10 border border-critical-line0/20">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-ink-2 line-through">{m.drug}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-critical-wash0/30 text-critical-on-solid">
                              Discontinued
                            </span>
                          </div>
                          <span className="text-[10px] text-ink-3 block mt-0.5">
                            Was {m.dose} · {m.frequency}
                          </span>
                        </div>
                      ))}
                      {diff.medications.continued.map((m, i) => (
                        <div key={i} className="p-2 rounded-lg bg-surface-base border border-rule">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink-1">{m.drug}</span>
                            <span className="text-[9px] text-ink-3">Unchanged</span>
                          </div>
                          <span className="text-[10px] text-ink-3 block mt-0.5">
                            {m.dose} · {m.frequency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-surface-elevated border-t border-rule flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-paper/10 hover:bg-paper/15 text-ink-1 font-semibold rounded-lg transition-colors cursor-pointer text-xs"
          >
            Close Diff
          </button>
        </div>
      </div>
    </div>
  );
}
