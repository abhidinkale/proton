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
      className={`p-4 rounded-2xl bg-white border border-[#E8E5DC] shadow-2xs hover:border-[#D5D2C9] transition-all flex flex-col justify-between ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#151619] text-white flex items-center justify-center font-bold text-xs shrink-0">
              <Stethoscope size={14} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#151719] truncate">{patientName}</h4>
              <p className="text-[10px] text-[#575D65]">{encounterType}</p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            isSigned
              ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
              : 'bg-[#FEF08A] text-[#854D0E] border-[#FDE047]'
          }`}>
            {isSigned ? <ShieldCheck size={10} /> : <Clock size={10} />}
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </span>
        </div>

        {chiefComplaint && (
          <p className="text-xs text-[#151719] font-medium mt-3 bg-[#FAF9F6] p-2 rounded-xl border border-[#F0ECE1]">
            &ldquo;{chiefComplaint}&rdquo;
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-[#575D65] font-mono">
          <span className="flex items-center gap-1">
            <Calendar size={11} className="text-[#88909A]" />
            {date}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <User size={11} className="text-[#88909A]" />
            {providerName}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#F0ECE1] flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#151719] hover:underline cursor-pointer"
        >
          <span>Open Workspace</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
});

export default EncounterCard;
