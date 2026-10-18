import { forwardRef } from 'react';
import { Lock } from 'lucide-react';

export interface AIReviewRequiredProps {
  onSignOff?: () => void;
  targetArtifact?: string;
  className?: string;
}

export const AIReviewRequired = forwardRef<HTMLDivElement, AIReviewRequiredProps>(function AIReviewRequired(
  {
    onSignOff,
    targetArtifact = 'Clinical Draft',
    className = ''
  },
  ref
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={`p-3.5 rounded-2xl bg-[#FEF08A]/70 border border-[#FDE047] text-[#854D0E] flex items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-xl bg-white/80 shrink-0 text-[#854D0E]">
          <Lock size={14} />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-bold truncate">Physician Review Required</h4>
          <p className="text-[11px] opacity-90 truncate">
            {targetArtifact} cannot be persisted to FHIR medical record without authenticated sign-off.
          </p>
        </div>
      </div>

      {onSignOff && (
        <button
          type="button"
          onClick={onSignOff}
          className="px-3 py-1.5 rounded-full bg-[#854D0E] hover:bg-[#713F12] text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
        >
          Review & Sign
        </button>
      )}
    </div>
  );
});

export default AIReviewRequired;
