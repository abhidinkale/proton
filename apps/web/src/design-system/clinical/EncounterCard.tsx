import { forwardRef } from 'react';
import { Stethoscope, Calendar, User, ArrowRight, ShieldCheck, Clock } from 'lucide-react';

export interface EncounterCardProps {
  id: string;
  patientName: string;
  encounterType: string;
  providerName: string;
  date: string;
  chiefComplaint?: string;
  status: 'planned' | 'in_progress' | 'signed' | 'discharged';
  onOpen: () => void;
  className?: string;
}

export const EncounterCard = forwardRef<HTMLDivElement, EncounterCardProps>(function EncounterCard(
  {
    patientName,
    encounterType,
    providerName,
    date,
    chiefComplaint,
    status,
    onOpen,
    className = ''
  },
  ref
) {
  const isSigned = status === 'signed' || status === 'discharged';

  return (
    <div
      ref={ref}
      className={`p-4 rounded-2xl bg-paper border border-rule shadow-2xs hover:border-rule-strong transition-all flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-solid text-white flex items-center justify-center font-bold text-xs shrink-0">
              <Stethoscope size={14} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink truncate">{patientName}</h4>
              <p className="text-[10px] text-ink-2">{encounterType}</p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            isSigned
              ? 'bg-settled-wash text-settled border-settled-line'
              : 'bg-caution-wash text-caution border-caution-line'
          }`}>
            {isSigned ? <ShieldCheck size={10} /> : <Clock size={10} />}
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </span>
        </div>

        {chiefComplaint && (
          <p className="text-xs text-ink font-medium mt-3 bg-canvas p-2 rounded-xl border border-rule">
            &ldquo;{chiefComplaint}&rdquo;
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-2 font-mono">
          <span className="flex items-center gap-1">
            <Calendar size={11} className="text-ink-3" />
            {date}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <User size={11} className="text-ink-3" />
            {providerName}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-rule flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline cursor-pointer"
        >
          <span>Open Workspace</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
});

export default EncounterCard;
