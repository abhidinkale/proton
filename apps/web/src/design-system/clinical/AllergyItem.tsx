import { forwardRef } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export interface AllergyItemProps {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis';
  verifiedBy?: string;
  className?: string;
}

export const AllergyItem = forwardRef<HTMLDivElement, AllergyItemProps>(function AllergyItem(
  {
    allergen,
    reaction,
    severity,
    verifiedBy,
    className = ''
  },
  ref
) {
  const isAnaphylaxis = severity === 'anaphylaxis' || severity === 'severe';

  const severityStyles = {
    mild: { bg: 'bg-[#FAF9F6]', border: 'border-[#E8E5DC]', text: 'text-[#575D65]' },
    moderate: { bg: 'bg-[#FEF08A]/50', border: 'border-[#FDE047]', text: 'text-[#854D0E]' },
    severe: { bg: 'bg-[#FFEDD5]', border: 'border-[#FED7AA]', text: 'text-[#9A3412]' },
    anaphylaxis: { bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', text: 'text-[#991B1B]' }
  }[severity];

  return (
    <div
      ref={ref}
      className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${severityStyles.bg} ${severityStyles.border} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={`p-1.5 rounded-xl shrink-0 ${isAnaphylaxis ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-black/5 text-[#575D65]'}`}>
          {isAnaphylaxis ? <AlertCircle size={15} /> : <AlertTriangle size={15} />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-[#151719] truncate">{allergen}</h4>
            <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
              isAnaphylaxis ? 'bg-[#991B1B] text-white' : 'bg-white text-[#575D65] border border-[#E8E5DC]'
            }`}>
              {severity}
            </span>
          </div>
          <p className="text-[11px] text-[#575D65] mt-0.5">Reaction: {reaction}</p>
        </div>
      </div>

      {verifiedBy && (
        <span className="text-[10px] text-[#88909A] font-mono shrink-0">
          Verified by {verifiedBy}
        </span>
      )}
    </div>
  );
});

export default AllergyItem;
