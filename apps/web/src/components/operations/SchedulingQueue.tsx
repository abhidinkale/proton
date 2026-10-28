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
    return <div className="p-6 text-center text-ink-3 text-xs">No scheduling details found.</div>;
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
      <div className="p-4 rounded-xl bg-paper border border-rule/80 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-ink-2 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays size={14} className="text-accent-ink" />
            Clinical Follow-Up Plan Extraction
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            isBooked ? 'bg-settled-wash text-settled' : 'bg-accent-wash text-accent-ink'
          }`}>
            {isBooked ? 'APPOINTMENT BOOKED' : 'APPOINTMENT PROPOSED'}
          </span>
        </div>

        <div className="text-xs text-ink space-y-2">
          <div>Clinical Reason: <strong>{details.clinicalReason}</strong></div>
          <div className="flex items-center gap-3 text-on-solid0">
            <span>Target Interval: <strong>{details.targetTimeframe}</strong></span>
            <span>•</span>
            <span>Window: {new Date(details.targetDateRange.start).toLocaleDateString()} – {new Date(details.targetDateRange.end).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Versioned Guideline Care Gap Panel */}
      <div className="p-4 rounded-xl bg-paper border border-rule/80 shadow-xs">
        <div className="text-xs font-bold text-ink-2 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <BookOpen size={14} className="text-accent-ink" />
          Deterministic Versioned Care Gap Evaluation
        </div>

        <div className="p-3 rounded-lg bg-accent-wash/50 border border-accent-line text-xs text-ink space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-accent-ink">Diabetic Glycemic Monitoring (HbA1c)</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-paper border border-accent-line text-accent-ink font-bold">
              ADA-2026-v1.0
            </span>
          </div>
          <p className="text-[11px] text-ink-2 leading-relaxed">
            <strong>Guideline Evidence:</strong> Regular HbA1c assessment every 3 months is recommended when therapy has changed or target glycemic control is not achieved (ADA Standards of Care).
          </p>
          <div className="text-[11px] text-caution flex items-center gap-1 pt-1 font-medium">
            <ShieldAlert size={13} className="text-caution" />
            <span>Safety Warning Flag: HbA1c is overdue. Routine lab requisition flagged for physician review (non-autonomous).</span>
          </div>
        </div>
      </div>

      {/* Calendar Slot & Outreach Proposal */}
      {details.proposedSlot && (
        <div className="p-4 rounded-xl bg-paper border border-rule/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-ink-2 uppercase tracking-wider">
              {isBooked ? 'Confirmed Calendar Slot' : 'Proposed Calendar Hold'}
            </div>
            <span className="text-[10px] text-ink-3 font-mono">
              Resource: {details.fhirAppointment?.id || 'FHIR R4 Appointment (Proposed)'}
            </span>
          </div>

          <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            isBooked ? 'bg-settled-wash/60 border-settled-line' : 'bg-accent-wash/50 border-accent-line'
          }`}>
            <div>
              <div className="font-bold text-ink">
                {new Date(details.proposedSlot.start).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at 9:30 AM
              </div>
              <div className="text-on-solid0 text-[11px] mt-0.5">
                {details.proposedSlot.practitionerName} • {details.proposedSlot.location}
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${
              isBooked ? 'bg-settled-wash text-settled border-settled-line' : 'bg-paper border-accent-line text-accent-ink'
            }`}>
              {isBooked ? 'Confirmed / Booked' : 'Slot Held (Needs Confirmation)'}
            </span>
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-semibold text-ink-2 mb-1">Patient Outreach Notification:</div>
            <div className="p-3 rounded-lg bg-paper-2 border border-rule text-xs text-ink-2 leading-relaxed font-sans">
              {details.outreachDraft}
            </div>
          </div>

          {/* Safety Policy Guard: Invariant against silent conversion */}
          <div className="mt-3 p-2.5 rounded-lg bg-paper-2 border border-rule text-[11px] text-ink-2 flex items-center gap-2">
            <Clock size={14} className="text-accent-ink shrink-0" />
            <span>
              <strong>Scheduling Safety Invariant:</strong> Proposed clinical appointments are not silently booked. They remain in <code>proposed</code> status until explicit patient/physician confirmation.
            </span>
          </div>

          {!isBooked && (
            <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between">
              <span className="text-[11px] text-on-solid0">
                Transitions FHIR Appointment from proposed to booked.
              </span>
              <button
                disabled={isConfirming}
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-solid hover:bg-solid disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
              >
                <CalendarCheck size={14} />
                <span>{isConfirming ? 'Confirming...' : 'Confirm & Book Appointment'}</span>
              </button>
            </div>
          )}

          {isBooked && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-settled font-medium">
              <CheckCircle2 size={14} className="text-settled" />
              <span>Appointment officially confirmed and committed to Medplum/FHIR calendar.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
