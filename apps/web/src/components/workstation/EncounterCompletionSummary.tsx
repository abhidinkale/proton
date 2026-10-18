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
    <div className="w-full max-w-xl mx-auto bg-white border border-[#e4e4e7] rounded-3xl p-8 shadow-sm space-y-6 text-center font-sans animate-in zoom-in-95 duration-200">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
        <CheckCircle2 size={32} />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          Encounter Complete & Sealed
        </span>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#09090b]">
          Clinical Encounter Completed
        </h2>
        <p className="text-xs text-[#52525b]">
          Documentation and orders for <strong className="text-[#09090b]">{patient.name}</strong> ({patient.mrn}) have been permanently committed to FHIR R4.
        </p>
      </div>

      {/* Persistence Checks */}
      <div className="p-4 rounded-2xl bg-[#fafaf9] border border-[#e4e4e7] text-left space-y-2 text-xs">
        <div className="flex items-center justify-between text-[#09090b]">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>SOAP Clinical Note Saved to FHIR DocumentReference</span>
          </span>
          <span className="text-[10px] text-[#71717a] font-mono">CONFIRMED</span>
        </div>
        <div className="flex items-center justify-between text-[#09090b]">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Prescriptions & Orders Saved to MedicationRequest</span>
          </span>
          <span className="text-[10px] text-[#71717a] font-mono">COMMITTED</span>
        </div>
        <div className="flex items-center justify-between text-[#09090b]">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Cryptographic AI Provenance Envelope Sealed</span>
          </span>
          <span className="text-[10px] text-[#71717a] font-mono">VERIFIED</span>
        </div>
        <div className="flex items-center justify-between text-[#09090b]">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Patient Handoff Instructions Prepared</span>
          </span>
          <span className="text-[10px] text-[#71717a] font-mono">READY</span>
        </div>
      </div>

      {/* Product North Star Productivity Metrics (Section 25) */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-4 rounded-2xl bg-[#fafaf9] border border-[#e4e4e7] space-y-0.5">
          <div className="flex items-center justify-center gap-1 text-[#71717a] text-[11px] font-semibold">
            <Clock size={12} />
            <span>Encounter Duration</span>
          </div>
          <div className="text-xl font-bold text-[#09090b]">
            {durationMinutes} min
          </div>
          <p className="text-[10px] text-[#a1a1aa]">Real timer elapsed</p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-0.5">
          <div className="flex items-center justify-center gap-1 text-emerald-800 text-[11px] font-semibold">
            <Sparkles size={12} className="text-emerald-600" />
            <span>Documentation Time Saved</span>
          </div>
          <div className="text-xl font-bold text-emerald-950">
            ~{timeSavedMinutes} min
          </div>
          <p className="text-[10px] text-emerald-800">vs 18 min manual EHR baseline</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onViewPatientHandoff}
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-[#e4e4e7] bg-white hover:bg-[#fafaf9] text-xs font-bold text-[#09090b] transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-2"
        >
          <FileText size={14} />
          <span>View Patient Care Plan</span>
        </button>

        <button
          type="button"
          onClick={onReturnToSchedule}
          className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#111315] hover:bg-[#262a2e] text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          <span>Return to Today&apos;s Schedule</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
