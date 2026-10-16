import React, { useState } from 'react';
import { 
  Share2, 
  FileText, 
  CheckCircle2, 
  Stethoscope 
} from 'lucide-react';
import type { OperationalTask } from '../../types/operations';

interface Props {
  task: OperationalTask;
  onApprove: () => Promise<void>;
}

export const ReferralPipeline: React.FC<Props> = ({ task, onApprove }) => {
  const details = task.referralDetails;
  const isSigned = details?.status === 'physician_signed' || task.status === 'completed';
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!details) {
    return <div className="p-6 text-center text-zinc-400 text-xs">No referral packet available.</div>;
  }

  const handleSign = async () => {
    setIsSubmitting(true);
    try {
      await onApprove();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Referral Order Overview */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
            <Share2 size={14} className="text-indigo-600" />
            Outbound Specialist Referral Pipeline
          </div>
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            {details.specialty}
          </span>
        </div>

        <div className="text-xs text-zinc-800 space-y-1.5 mb-3">
          <div>Specialty: <strong>{details.specialty}</strong> (SNOMED CT: <code>{details.specialtyCode || '394589003'}</code>)</div>
          <div>Target Provider: <strong>{details.targetProviderOrClinic}</strong></div>
          <div>Clinical Indication: <em>{details.clinicalIndication}</em></div>
        </div>

        {/* Structured Clinical Packet */}
        <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs space-y-2.5">
          <div className="text-[11px] font-bold text-zinc-700 uppercase tracking-wide flex items-center gap-1.5">
            <Stethoscope size={13} className="text-indigo-600" />
            <span>Auto-Compiled Clinical Referral Packet</span>
          </div>

          <p className="text-zinc-700 text-xs leading-relaxed">
            <strong>Clinical History:</strong> {details.referralSummaryPacket.hpiSummary}
          </p>

          <div>
            <strong>Pertinent Laboratory Trajectory:</strong>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {details.referralSummaryPacket.relevantLabs.map((l, i) => (
                <div key={i} className="p-2 bg-white rounded border border-zinc-200 text-[11px]">
                  <div className="text-zinc-500">{l.name}</div>
                  <div className="font-bold text-zinc-900">{l.value}</div>
                  <div className="text-[9px] text-zinc-400">{l.date}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-zinc-600">
            <strong>Active Medication Regimen:</strong> {details.referralSummaryPacket.currentMedications.join(' • ')}
          </div>
          <div className="text-[11px] text-zinc-600">
            <strong>Documented Allergies:</strong> {details.referralSummaryPacket.documentedAllergies.join(', ')}
          </div>
          <div className="text-[11px] text-zinc-600">
            <strong>Baseline Vitals:</strong> {details.referralSummaryPacket.vitalsSummary}
          </div>
        </div>

        {!isSigned ? (
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              Signs FHIR ServiceRequest and opens referral loop-closure tracking.
            </span>
            <button
              disabled={isSubmitting}
              onClick={handleSign}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
            >
              <FileText size={14} />
              <span>{isSubmitting ? 'Signing Packet...' : 'Sign & Transmit Referral Packet'}</span>
            </button>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Signed by Dr. Sarah Lin, MD • FHIR ServiceRequest dispatched to Nephrology. Loop-closure active.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
