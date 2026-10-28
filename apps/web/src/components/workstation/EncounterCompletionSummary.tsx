import { CheckCircle2, Clock, ArrowRight, FileText, Sparkles } from 'lucide-react';
import type { DoctorDeskPatient } from '../DoctorDeskEncounter';

interface EncounterCompletionSummaryProps {
  patient: DoctorDeskPatient;
  durationSeconds: number;
  timeSavedMinutes: number;
  onReturnToSchedule: () => void;
  onViewPatientHandoff: () => void;
}

export default function EncounterCompletionSummary({
  patient,
  durationSeconds,
  timeSavedMinutes,
  onReturnToSchedule,
  onViewPatientHandoff
}: EncounterCompletionSummaryProps) {
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  return (
    <div className="w-full max-w-xl mx-auto bg-paper border border-rule rounded-3xl p-8 shadow-sm space-y-6 text-center font-sans animate-in zoom-in-95 duration-200">
      <div className="w-14 h-14 rounded-2xl bg-settled-wash border border-settled-line text-settled flex items-center justify-center mx-auto shadow-2xs">
        <CheckCircle2 size={32} />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-settled bg-settled-wash px-2.5 py-0.5 rounded-full border border-settled-line">
          Encounter Complete & Sealed
        </span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
          Clinical Encounter Completed
        </h2>
        <p className="text-xs text-ink-2">
          Documentation and orders for <strong className="text-ink">{patient.name}</strong> ({patient.mrn}) have been permanently committed to FHIR R4.
        </p>
      </div>

      {/* Persistence Checks */}
      <div className="p-4 rounded-2xl bg-canvas border border-rule text-left space-y-2 text-xs">
        <div className="flex items-center justify-between text-ink">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-settled" />
            <span>SOAP Clinical Note Saved to FHIR DocumentReference</span>
          </span>
          <span className="text-[10px] text-ink-2 font-mono">CONFIRMED</span>
        </div>
        <div className="flex items-center justify-between text-ink">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-settled" />
            <span>Prescriptions & Orders Saved to MedicationRequest</span>
          </span>
          <span className="text-[10px] text-ink-2 font-mono">COMMITTED</span>
        </div>
        <div className="flex items-center justify-between text-ink">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-settled" />
            <span>Cryptographic AI Provenance Envelope Sealed</span>
          </span>
          <span className="text-[10px] text-ink-2 font-mono">VERIFIED</span>
        </div>
        <div className="flex items-center justify-between text-ink">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-settled" />
            <span>Patient Handoff Instructions Prepared</span>
          </span>
          <span className="text-[10px] text-ink-2 font-mono">READY</span>
        </div>
      </div>

      {/* Product North Star Productivity Metrics (Section 25) */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-0.5">
          <div className="flex items-center justify-center gap-1 text-ink-2 text-[11px] font-semibold">
            <Clock size={12} />
            <span>Encounter Duration</span>
          </div>
          <div className="text-xl font-bold text-ink">
            {durationMinutes} min
          </div>
          <p className="text-[10px] text-ink-3">Real timer elapsed</p>
        </div>

        <div className="p-4 rounded-2xl bg-settled-wash/70 border border-settled-line/80 space-y-0.5">
          <div className="flex items-center justify-center gap-1 text-settled text-[11px] font-semibold">
            <Sparkles size={12} className="text-settled" />
            <span>Documentation Time Saved</span>
          </div>
          <div className="text-xl font-bold text-settled">
            ~{timeSavedMinutes} min
          </div>
          <p className="text-[10px] text-settled">vs 18 min manual EHR baseline</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onViewPatientHandoff}
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-rule bg-paper hover:bg-canvas text-xs font-bold text-ink transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-2"
        >
          <FileText size={14} />
          <span>View Patient Care Plan</span>
        </button>

        <button
          type="button"
          onClick={onReturnToSchedule}
          className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-solid hover:bg-solid text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          <span>Return to Today&apos;s Schedule</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
