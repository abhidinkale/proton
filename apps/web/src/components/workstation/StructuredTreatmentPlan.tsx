import { useState } from 'react';
import { 
  Pill, Activity, Calendar, MessageSquare, Plus, Trash2 
} from 'lucide-react';

export interface PlanMedication {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  indication: string;
  status: 'draft' | 'approved';
  isEdited?: boolean;
}

export interface PlanInvestigation {
  id: string;
  testName: string;
  category: 'Laboratory' | 'Diagnostic Imaging' | 'Procedure';
  urgency: 'Routine' | 'Urgent' | 'Stat';
  indication: string;
  status: 'draft' | 'approved';
  isEdited?: boolean;
}

export interface StructuredPlanState {
  medications: PlanMedication[];
  investigations: PlanInvestigation[];
  followUp: {
    timeframe: string;
    specialty: string;
    instructions: string;
    status: 'draft' | 'approved';
    isEdited?: boolean;
  };
  patientInstructions: {
    text: string;
    status: 'draft' | 'approved';
    isEdited?: boolean;
  };
}

interface StructuredTreatmentPlanProps {
  plan: StructuredPlanState;
  onChange: (updated: StructuredPlanState) => void;
  onProvenanceInvalidated?: () => void;
}

export default function StructuredTreatmentPlan({
  plan,
  onChange,
  onProvenanceInvalidated
}: StructuredTreatmentPlanProps) {
  const [newMed, setNewMed] = useState({
    name: '',
    dose: '',
    route: 'Oral',
    frequency: 'Once daily',
    duration: '90 days',
    indication: ''
  });

  const [newInv, setNewInv] = useState({
    testName: '',
    category: 'Laboratory' as const,
    urgency: 'Routine' as const,
    indication: ''
  });

  const notifyEdit = () => {
    if (onProvenanceInvalidated) {
      onProvenanceInvalidated();
    }
  };

  const handleUpdateMed = (id: string, updates: Partial<PlanMedication>) => {
    const nextMeds = plan.medications.map(m => {
      if (m.id === id) {
        return { ...m, ...updates, isEdited: true, status: 'draft' as const };
      }
      return m;
    });
    onChange({ ...plan, medications: nextMeds });
    notifyEdit();
  };

  const handleDeleteMed = (id: string) => {
    onChange({ ...plan, medications: plan.medications.filter(m => m.id !== id) });
    notifyEdit();
  };

  const handleAddMed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name.trim()) return;
    const item: PlanMedication = {
      id: `rx-${Date.now()}`,
      name: newMed.name.trim(),
      dose: newMed.dose.trim() || 'Standard Dose',
      route: newMed.route || 'Oral',
      frequency: newMed.frequency || 'Once daily',
      duration: newMed.duration || '90 days',
      indication: newMed.indication || 'Clinical indication',
      status: 'draft',
      isEdited: true
    };
    onChange({ ...plan, medications: [...plan.medications, item] });
    setNewMed({ name: '', dose: '', route: 'Oral', frequency: 'Once daily', duration: '90 days', indication: '' });
    notifyEdit();
  };

  const handleAddInv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInv.testName.trim()) return;
    const item: PlanInvestigation = {
      id: `inv-${Date.now()}`,
      testName: newInv.testName.trim(),
      category: newInv.category,
      urgency: newInv.urgency,
      indication: newInv.indication || 'Diagnostic evaluation',
      status: 'draft',
      isEdited: true
    };
    onChange({ ...plan, investigations: [...plan.investigations, item] });
    setNewInv({ testName: '', category: 'Laboratory', urgency: 'Routine', indication: '' });
    notifyEdit();
  };

  const handleDeleteInv = (id: string) => {
    onChange({ ...plan, investigations: plan.investigations.filter(i => i.id !== id) });
    notifyEdit();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ── 1. MEDICATIONS SECTION ── */}
      <div className="rounded-2xl border border-rule bg-paper p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-settled-wash text-settled flex items-center justify-center">
              <Pill size={14} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
              Prescriptions & Medication Orders
            </h3>
            <span className="text-[10px] font-bold text-caution bg-caution-wash border border-caution-line px-2 py-0.5 rounded-full">
              DRAFT
            </span>
          </div>
          <span className="text-[11px] text-ink-2">
            {plan.medications.length} items staged
          </span>
        </div>

        {/* Existing Medications Table / Cards */}
        <div className="space-y-2">
          {plan.medications.map(med => (
            <div
              key={med.id}
              className={`p-3 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                med.isEdited
                  ? 'bg-caution-wash/40 border-caution-line/80'
                  : 'bg-canvas border-rule'
              }`}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-ink">{med.name}</span>
                  <input
                    type="text"
                    value={med.dose}
                    onChange={e => handleUpdateMed(med.id, { dose: e.target.value })}
                    className="text-xs font-mono font-medium bg-paper border border-rule rounded px-2 py-0.5 w-24 outline-none focus:border-solid"
                    title="Click to edit dose"
                  />
                  <span className="text-xs text-ink-2">&bull; {med.route} &bull;</span>
                  <input
                    type="text"
                    value={med.frequency}
                    onChange={e => handleUpdateMed(med.id, { frequency: e.target.value })}
                    className="text-xs bg-paper border border-rule rounded px-2 py-0.5 w-36 outline-none focus:border-solid"
                    title="Click to edit frequency"
                  />
                  <span className="text-xs text-ink-2 font-mono">({med.duration})</span>
                </div>
                {med.indication && (
                  <p className="text-[11px] text-ink-2">Indication: {med.indication}</p>
                )}
                {med.isEdited && (
                  <span className="inline-block text-[10px] font-semibold text-caution bg-caution-wash/70 px-1.5 py-0.2 rounded">
                    Edited by Clinician (Pending Sign-off)
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteMed(med.id)}
                className="text-ink-3 hover:text-critical p-1 rounded-md transition-colors self-end sm:self-center cursor-pointer"
                title="Remove prescription"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {plan.medications.length === 0 && (
            <div className="text-center py-4 text-xs text-ink-2 italic">
              No medications in draft plan. Add below or adopt from clinical perspectives.
            </div>
          )}
        </div>

        {/* Add Medication Form */}
        <form onSubmit={handleAddMed} className="pt-2 border-t border-rule flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Medication name..."
            value={newMed.name}
            onChange={e => setNewMed({ ...newMed, name: e.target.value })}
            className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg border border-rule bg-paper outline-none focus:border-solid"
          />
          <input
            type="text"
            placeholder="Dose (e.g. 500 mg)"
            value={newMed.dose}
            onChange={e => setNewMed({ ...newMed, dose: e.target.value })}
            className="w-28 px-2.5 py-1.5 rounded-lg border border-rule bg-paper outline-none focus:border-solid"
          />
          <input
            type="text"
            placeholder="Freq (e.g. Twice daily)"
            value={newMed.frequency}
            onChange={e => setNewMed({ ...newMed, frequency: e.target.value })}
            className="w-32 px-2.5 py-1.5 rounded-lg border border-rule bg-paper outline-none focus:border-solid"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-solid hover:bg-solid text-white font-semibold cursor-pointer shadow-2xs"
          >
            <Plus size={12} />
            <span>Add Rx</span>
          </button>
        </form>
      </div>

      {/* ── 2. INVESTIGATIONS SECTION ── */}
      <div className="rounded-2xl border border-rule bg-paper p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-accent-wash text-accent-ink flex items-center justify-center">
              <Activity size={14} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
              Diagnostic Investigations & Orders
            </h3>
            <span className="text-[10px] font-bold text-caution bg-caution-wash border border-caution-line px-2 py-0.5 rounded-full">
              DRAFT
            </span>
          </div>
          <span className="text-[11px] text-ink-2">
            {plan.investigations.length} orders staged
          </span>
        </div>

        <div className="space-y-2">
          {plan.investigations.map(inv => (
            <div
              key={inv.id}
              className="p-3 rounded-xl bg-canvas border border-rule flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="font-bold text-ink flex items-center gap-2">
                  <span>{inv.testName}</span>
                  <span className="text-[10px] font-semibold text-accent-ink bg-accent-wash border border-accent-line px-1.5 py-0.2 rounded">
                    {inv.category}
                  </span>
                  <span className="text-[10px] text-ink-2 font-mono">
                    Urgency: {inv.urgency}
                  </span>
                </div>
                {inv.indication && (
                  <p className="text-[11px] text-ink-2">Clinical Indication: {inv.indication}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteInv(inv.id)}
                className="text-ink-3 hover:text-critical p-1 cursor-pointer"
                title="Remove investigation order"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {plan.investigations.length === 0 && (
            <div className="text-center py-4 text-xs text-ink-2 italic">
              No investigations ordered.
            </div>
          )}
        </div>

        {/* Add Investigation Form */}
        <form onSubmit={handleAddInv} className="pt-2 border-t border-rule flex items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Order lab or imaging (e.g. Comprehensive Metabolic Panel, Stress Echo)..."
            value={newInv.testName}
            onChange={e => setNewInv({ ...newInv, testName: e.target.value })}
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-rule bg-paper outline-none focus:border-solid"
          />
          <select
            value={newInv.category}
            onChange={e => setNewInv({ ...newInv, category: e.target.value as any })}
            className="px-2 py-1.5 rounded-lg border border-rule bg-paper outline-none font-medium cursor-pointer"
          >
            <option value="Laboratory">Laboratory</option>
            <option value="Diagnostic Imaging">Imaging</option>
            <option value="Procedure">Procedure</option>
          </select>
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-solid hover:bg-solid text-white font-semibold cursor-pointer shadow-2xs"
          >
            <Plus size={12} />
            <span>Order</span>
          </button>
        </form>
      </div>

      {/* ── 3. FOLLOW-UP & PATIENT INSTRUCTIONS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Follow-up */}
        <div className="rounded-2xl border border-rule bg-paper p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-rule pb-2">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-accent-ink" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                Clinical Follow-up
              </h3>
            </div>
            <span className="text-[10px] font-bold text-caution bg-caution-wash border border-caution-line px-1.5 py-0.2 rounded">
              DRAFT
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-ink-2 block mb-1">
                Timeframe:
              </label>
              <input
                type="text"
                value={plan.followUp.timeframe}
                onChange={e => {
                  onChange({
                    ...plan,
                    followUp: { ...plan.followUp, timeframe: e.target.value, isEdited: true }
                  });
                  notifyEdit();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-rule bg-canvas outline-none focus:border-solid"
                placeholder="e.g. Return in 3 months for repeat labs"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-ink-2 block mb-1">
                Specialty Clinic / Referral:
              </label>
              <input
                type="text"
                value={plan.followUp.specialty}
                onChange={e => {
                  onChange({
                    ...plan,
                    followUp: { ...plan.followUp, specialty: e.target.value, isEdited: true }
                  });
                  notifyEdit();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-rule bg-canvas outline-none focus:border-solid"
                placeholder="e.g. Internal Medicine Outpatient Clinic"
              />
            </div>
          </div>
        </div>

        {/* Patient Instructions */}
        <div className="rounded-2xl border border-rule bg-paper p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-rule pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-settled" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                Patient Instructions (Plain Language)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-caution bg-caution-wash border border-caution-line px-1.5 py-0.2 rounded">
              DRAFT
            </span>
          </div>

          <div>
            <textarea
              rows={4}
              value={plan.patientInstructions.text}
              onChange={e => {
                onChange({
                  ...plan,
                  patientInstructions: { ...plan.patientInstructions, text: e.target.value, isEdited: true }
                });
                notifyEdit();
              }}
              className="w-full p-2.5 rounded-lg border border-rule bg-canvas text-xs text-ink outline-none focus:border-solid resize-y"
              placeholder="Concise, plain-language patient care instructions..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
