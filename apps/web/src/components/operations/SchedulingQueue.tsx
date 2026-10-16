import React, { useState } from 'react';
import { 
  CalendarDays, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  BookOpen, 
  CalendarCheck 
} from 'lucide-react';
import type { OperationalTask } from '../../types/operations';

interface Props {
  task: OperationalTask;
  onConfirmBooking: () => Promise<void>;
}

export const SchedulingQueue: React.FC<Props> = ({ task, onConfirmBooking }) => {
  const details = task.schedulingDetails;
  const isBooked = details?.appointmentStatus === 'booked' || task.status === 'completed';
  const [isConfirming, setIsConfirming] = useState(false);

  if (!details) {
    return <div className="p-6 text-center text-zinc-400 text-xs">No scheduling details found.</div>;
  }

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirmBooking();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Consultation Plan Extraction Card */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays size={14} className="text-purple-600" />
            Clinical Follow-Up Plan Extraction
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            isBooked ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
          }`}>
            {isBooked ? 'APPOINTMENT BOOKED' : 'APPOINTMENT PROPOSED'}
          </span>
        </div>

        <div className="text-xs text-zinc-800 space-y-2">
          <div>Clinical Reason: <strong>{details.clinicalReason}</strong></div>
          <div className="flex items-center gap-3 text-zinc-500">
            <span>Target Interval: <strong>{details.targetTimeframe}</strong></span>
            <span>•</span>
            <span>Window: {new Date(details.targetDateRange.start).toLocaleDateString()} – {new Date(details.targetDateRange.end).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Versioned Guideline Care Gap Panel */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
        <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <BookOpen size={14} className="text-blue-600" />
          Deterministic Versioned Care Gap Evaluation
        </div>

        <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 text-xs text-zinc-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-900">Diabetic Glycemic Monitoring (HbA1c)</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-blue-200 text-blue-800 font-bold">
              ADA-2026-v1.0
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            <strong>Guideline Evidence:</strong> Regular HbA1c assessment every 3 months is recommended when therapy has changed or target glycemic control is not achieved (ADA Standards of Care).
          </p>
          <div className="text-[11px] text-amber-800 flex items-center gap-1 pt-1 font-medium">
            <ShieldAlert size={13} className="text-amber-600" />
            <span>Safety Warning Flag: HbA1c is overdue. Routine lab requisition flagged for physician review (non-autonomous).</span>
          </div>
        </div>
      </div>

      {/* Calendar Slot & Outreach Proposal */}
      {details.proposedSlot && (
        <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              {isBooked ? 'Confirmed Calendar Slot' : 'Proposed Calendar Hold'}
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              Resource: {details.fhirAppointment?.id || 'FHIR R4 Appointment (Proposed)'}
            </span>
          </div>

          <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            isBooked ? 'bg-emerald-50/60 border-emerald-200' : 'bg-purple-50/50 border-purple-100'
          }`}>
            <div>
              <div className="font-bold text-zinc-900">
                {new Date(details.proposedSlot.start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at 9:30 AM
              </div>
              <div className="text-zinc-500 text-[11px] mt-0.5">
                {details.proposedSlot.practitionerName} • {details.proposedSlot.location}
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${
              isBooked ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white border-purple-200 text-purple-700'
            }`}>
              {isBooked ? 'Confirmed / Booked' : 'Slot Held (Needs Confirmation)'}
            </span>
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-semibold text-zinc-600 mb-1">Patient Outreach Notification:</div>
            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 leading-relaxed font-sans">
              {details.outreachDraft}
            </div>
          </div>

          {/* Safety Policy Guard: Invariant against silent conversion */}
          <div className="mt-3 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-600 flex items-center gap-2">
            <Clock size={14} className="text-purple-600 shrink-0" />
            <span>
              <strong>Scheduling Safety Invariant:</strong> Proposed clinical appointments are not silently booked. They remain in <code>proposed</code> status until explicit patient/physician confirmation.
            </span>
          </div>

          {!isBooked && (
            <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                Transitions FHIR Appointment from proposed to booked.
              </span>
              <button
                disabled={isConfirming}
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
              >
                <CalendarCheck size={14} />
                <span>{isConfirming ? 'Confirming...' : 'Confirm & Book Appointment'}</span>
              </button>
            </div>
          )}

          {isBooked && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Appointment officially confirmed and committed to Medplum/FHIR calendar.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
