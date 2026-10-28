import React, { useState } from 'react';
import { 
  Pill, 
  Shield, 
  AlertTriangle, 
  FileCheck, 
  CheckCircle2 
} from 'lucide-react';
import type { OperationalTask } from '../../types/operations';

interface Props {
  task: OperationalTask;
  onApprove: (decision: {
    actionType: 'approve_standard' | 'modify_dosage' | 'deny_request';
    clinicalDecisionNotes: string;
    prescribedDose?: string;
    daysSupply?: number;
  }) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

export const RefillApprovalCard: React.FC<Props> = ({ task, onApprove, onReject }) => {
  const details = task.refillDetails;

  const [actionType, setActionType] = useState<'approve_standard' | 'modify_dosage' | 'deny_request'>(
    details?.physicianAction?.actionType || 'approve_standard'
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>(
    details?.physicianAction?.clinicalDecisionNotes || ''
  );
  const [prescribedDose, setPrescribedDose] = useState<string>(
    details?.physicianAction?.prescribedDose || details?.requestedDose || ''
  );
  const [daysSupply, setDaysSupply] = useState<number>(
    details?.physicianAction?.daysSupply || details?.daysSupply || 30
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!details) {
    return <div className="p-6 text-center text-ink-3 text-xs">No refill details found.</div>;
  }

  const isCompleted = task.status === 'completed';

  const handleSubmit = async () => {
    if (!clinicalNotes.trim()) {
      alert('Physician clinical directive & rationale are strictly required before signing or adjusting a prescription refill.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (actionType === 'deny_request') {
        await onReject(clinicalNotes);
      } else {
        await onApprove({
          actionType,
          clinicalDecisionNotes: clinicalNotes,
          prescribedDose: actionType === 'modify_dosage' ? prescribedDose : details.requestedDose,
          daysSupply
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Strict Human Authority Banner */}
      <div className="p-3.5 rounded-xl bg-caution-wash/80 border border-caution-line flex items-start gap-2.5 text-xs text-caution">
        <Shield size={16} className="text-caution shrink-0 mt-0.5" />
        <div>
          <strong>Strict Clinical Authority Boundary:</strong> The Refill Agent does not make autonomous clinical refill decisions or generate treatment recommendations. Below is the deterministic safety report and longitudinal lab trajectory. You (the attending physician) hold sole authority to independently determine the clinical action.
        </div>
      </div>

      {/* Refill Request Details */}
      <div className="p-4 rounded-xl bg-paper border border-rule/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-ink-2 uppercase tracking-wider flex items-center gap-1.5">
            <Pill size={14} className="text-caution" />
            Electronic Prescription Refill Request
          </div>
          <span className="text-xs font-mono text-on-solid0">
            Prior Order: #{details.priorMedicationRequestId || 'HISTORICAL-ORDER'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-paper-2 border border-rule text-xs">
          <div>
            <div className="text-ink-3 text-[10px]">Medication</div>
            <div className="font-semibold text-ink">{details.medicationName}</div>
          </div>
          <div>
            <div className="text-ink-3 text-[10px]">Requested Dose</div>
            <div className="font-semibold text-ink">{details.requestedDose} ({details.requestedFrequency})</div>
          </div>
          <div>
            <div className="text-ink-3 text-[10px]">Days Supply</div>
            <div className="font-semibold text-ink">{details.daysSupply} days</div>
          </div>
          <div>
            <div className="text-ink-3 text-[10px]">Pharmacy</div>
            <div className="font-semibold text-ink truncate">{details.pharmacyName || 'Surescripts Electronic'}</div>
          </div>
        </div>
      </div>

      {/* Deterministic Safety & Renal Drift Trajectory Report */}
      <div className="p-4 rounded-xl bg-paper border border-rule/80 shadow-xs space-y-3">
        <div className="text-xs font-bold text-ink-2 uppercase tracking-wider flex items-center justify-between">
          <span>Deterministic Safety Verification</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-settled-wash text-settled border border-settled-line">
            No Allergy Blockers
          </span>
        </div>

        {/* Clinical Warnings */}
        {details.safetyReport.warnings.map((w, idx) => (
          <div key={idx} className="p-3 rounded-lg bg-caution-wash border border-caution-line text-xs text-caution flex items-start gap-2">
            <AlertTriangle size={15} className="text-caution shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Safety Advisory Alert</div>
              <div className="mt-0.5 leading-relaxed">{w}</div>
            </div>
          </div>
        ))}

        {/* Clinical Evidence & Citations */}
        <div className="p-3 rounded-lg bg-paper-2 border border-rule text-xs space-y-1">
          <div className="text-[11px] text-on-solid0 font-medium">Verified Longitudinal Chart Data:</div>
          <div className="text-ink">Indication: <strong>{details.clinicalContext.indication}</strong></div>
          <div className="text-ink font-mono text-[11px]">
            {details.clinicalContext.relevantLabSummary}
          </div>
        </div>
      </div>

      {/* Physician Decision Form (Strictly Neutral & Non-Prescriptive) */}
      <div className="p-4 rounded-xl bg-paper border border-rule/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
            <Shield size={14} className="text-accent-ink" />
            <span>Physician Clinical Decision Required</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent-wash text-accent-ink border border-accent-line">
            Independent MD Order
          </span>
        </div>

        <p className="text-xs text-ink-2 leading-relaxed">
          In accordance with Proton safety boundaries, AI agents do not propose, rank, or select treatment dosages. Review the evidence and renal trajectory above to determine your independent clinical directive.
        </p>

        {!isCompleted ? (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[11px] font-semibold text-ink-2 block mb-1">
                Clinical Action Determination:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'approve_standard', label: 'Authorize Standard Refill', desc: 'Maintain current dose & schedule' },
                  { id: 'modify_dosage', label: 'Modify Regimen / Renal Adjust', desc: 'Independently adjust dose or supply' },
                  { id: 'deny_request', label: 'Deny Refill Request', desc: 'Hold fill pending clinic evaluation' }
                ].map(act => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActionType(act.id as any)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                      actionType === act.id
                        ? 'bg-solid text-white border-rule-strong shadow-xs'
                        : 'bg-paper text-ink border-rule hover:bg-paper-2'
                    }`}
                  >
                    <div className="text-xs font-bold">{act.label}</div>
                    <div className={`text-[10px] mt-0.5 ${actionType === act.id ? 'text-ink-3' : 'text-on-solid0'}`}>{act.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {actionType === 'modify_dosage' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-paper-2 rounded-lg border border-rule text-xs">
                <div>
                  <label className="text-[11px] font-medium text-ink-2 block mb-1">
                    Physician Prescribed Dose:
                  </label>
                  <input
                    type="text"
                    value={prescribedDose}
                    onChange={(e) => setPrescribedDose(e.target.value)}
                    placeholder="e.g. 2.5mg BID"
                    className="w-full text-xs p-2 bg-paper rounded border border-rule focus:outline-hidden focus:ring-1 focus:ring-rule-strong"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-2 block mb-1">
                    Authorized Days Supply:
                  </label>
                  <input
                    type="number"
                    value={daysSupply}
                    onChange={(e) => setDaysSupply(parseInt(e.target.value, 10) || 30)}
                    placeholder="30"
                    className="w-full text-xs p-2 bg-paper rounded border border-rule focus:outline-hidden focus:ring-1 focus:ring-rule-strong"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-ink-2 block mb-1">
                Physician Clinical Directive & Rationale (Mandatory):
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Authorized 30-day supply with requirement for repeat renal panel in 3 weeks due to eGFR decline from 62 to 48 mL/min."
                className="w-full p-2.5 text-xs text-ink border border-rule rounded-lg focus:outline-hidden focus:ring-1 focus:ring-rule-strong"
              />
            </div>

            <div className="pt-2 border-t border-rule flex items-center justify-between">
              <span className="text-[11px] text-on-solid0">
                Signing writes an active MedicationRequest to HL7 FHIR R4 and emits a signed audit record.
              </span>
              <button
                disabled={isSubmitting || !clinicalNotes.trim()}
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-solid hover:bg-solid disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
              >
                <FileCheck size={14} />
                <span>{isSubmitting ? 'Signing Order...' : 'Sign & Commit Physician Order to FHIR'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-paper-2 rounded-lg border border-rule text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-settled font-semibold font-mono text-[11px]">
              <CheckCircle2 size={13} className="text-settled" />
              <span>PHYSICIAN ORDER SIGNED & COMMITTED TO FHIR R4:</span>
            </div>
            <div>Directive: <em>{details.physicianAction?.clinicalDecisionNotes || 'Physician Authorized'}</em></div>
            <div>Prescribed Regimen: <strong>{details.physicianAction?.prescribedDose || details.requestedDose}</strong> ({details.physicianAction?.daysSupply || details.daysSupply} days)</div>
            <div className="text-[10px] text-ink-3 font-mono">
              Signed By: {details.approvedBy} • Resource: {details.fhirMedicationRequest?.id || 'FHIR R4 MedicationRequest'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
