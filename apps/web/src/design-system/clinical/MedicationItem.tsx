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
          ? 'bg-critical-wash/60 border-critical-line'
          : isAiSuggestion
          ? 'bg-accent-wash border-accent-line'
          : 'bg-paper border-rule'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${
            interactionWarning ? 'bg-critical-wash text-critical' : 'bg-accent-wash text-accent-ink'
          }`}>
            <Pill size={15} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-ink truncate">{name}</h4>
              <span className="text-[11px] font-mono text-ink-2">{dosage}</span>
              <span className="text-[10px] text-ink-3">({route})</span>
              {status !== 'active' && (
                <span className="text-[9px] uppercase font-bold text-ink-3 px-1.5 py-0.2 rounded bg-canvas border border-rule">
                  {status}
                </span>
              )}
            </div>

            <p className="text-[11px] text-ink-2 mt-0.5">{frequency}</p>

            {/* Interaction Warning Callout */}
            {interactionWarning && (
              <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-xl bg-critical-wash border border-critical-line text-[10px] font-bold text-critical">
                <AlertTriangle size={11} className="shrink-0" />
                <span>Interaction Alert: {interactionWarning}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {isAiSuggestion ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-accent-wash text-accent-ink border border-accent-line">
              AI Draft (Review Req)
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-settled-wash text-settled border border-settled-line">
              <ShieldCheck size={10} />
              Approved
            </span>
          )}

          {onAction && (
            <button
              type="button"
              onClick={onAction}
              className="text-[11px] text-ink hover:underline cursor-pointer font-semibold mt-1"
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
