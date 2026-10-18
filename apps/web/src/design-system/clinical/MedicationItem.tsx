import { forwardRef } from 'react';
import { Pill, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface MedicationItemProps {
  name: string;
  dosage: string;
  route?: string;
  frequency: string;
  status?: 'active' | 'discontinued' | 'draft' | 'pending';
  interactionWarning?: string;
  provenance?: 'PHYSICIAN_APPROVED' | 'AI_SUGGESTION' | 'PATIENT_REPORTED';
  onAction?: () => void;
  className?: string;
}

export const MedicationItem = forwardRef<HTMLDivElement, MedicationItemProps>(function MedicationItem(
  {
    name,
    dosage,
    route = 'oral',
    frequency,
    status = 'active',
    interactionWarning,
    provenance = 'PHYSICIAN_APPROVED',
    onAction,
    className = ''
  },
  ref
) {
  const isAiSuggestion = provenance === 'AI_SUGGESTION';

  return (
    <div
      ref={ref}
      className={`p-3.5 rounded-2xl border transition-all ${
        interactionWarning
          ? 'bg-[#FEF2F2]/60 border-[#FECACA]'
          : isAiSuggestion
          ? 'bg-[#FDF2F8] border-[#FBCFE8]'
          : 'bg-white border-[#E8E5DC]'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${
            interactionWarning ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#EFF6FF] text-[#1E40AF]'
          }`}>
            <Pill size={15} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-[#151719] truncate">{name}</h4>
              <span className="text-[11px] font-mono text-[#575D65]">{dosage}</span>
              <span className="text-[10px] text-[#88909A]">({route})</span>
              {status !== 'active' && (
                <span className="text-[9px] uppercase font-bold text-[#88909A] px-1.5 py-0.2 rounded bg-[#FAF9F6] border border-[#E8E5DC]">
                  {status}
                </span>
              )}
            </div>

            <p className="text-[11px] text-[#575D65] mt-0.5">{frequency}</p>

            {/* Interaction Warning Callout */}
            {interactionWarning && (
              <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[10px] font-bold text-[#991B1B]">
                <AlertTriangle size={11} className="shrink-0" />
                <span>Interaction Alert: {interactionWarning}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {isAiSuggestion ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8]">
              AI Draft (Review Req)
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
              <ShieldCheck size={10} />
              Approved
            </span>
          )}

          {onAction && (
            <button
              type="button"
              onClick={onAction}
              className="text-[11px] text-[#151719] hover:underline cursor-pointer font-semibold mt-1"
            >
              Modify
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default MedicationItem;
