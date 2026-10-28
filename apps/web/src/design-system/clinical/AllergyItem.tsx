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
    mild: { bg: 'bg-canvas', border: 'border-rule', text: 'text-ink-2' },
    moderate: { bg: 'bg-caution-wash/50', border: 'border-caution-line', text: 'text-caution' },
    severe: { bg: 'bg-caution-wash', border: 'border-caution-line', text: 'text-caution' },
    anaphylaxis: { bg: 'bg-critical-wash', border: 'border-critical-line', text: 'text-critical' }
  }[severity];

  return (
    <div
      ref={ref}
      className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${severityStyles.bg} ${severityStyles.border} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={`p-1.5 rounded-xl shrink-0 ${isAnaphylaxis ? 'bg-critical-wash text-critical' : 'bg-black/5 text-ink-2'}`}>
          {isAnaphylaxis ? <AlertCircle size={15} /> : <AlertTriangle size={15} />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-ink truncate">{allergen}</h4>
            <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
              isAnaphylaxis ? 'bg-critical text-white' : 'bg-paper text-ink-2 border border-rule'
            }`}>
              {severity}
            </span>
          </div>
          <p className="text-[11px] text-ink-2 mt-0.5">Reaction: {reaction}</p>
        </div>
      </div>

      {verifiedBy && (
        <span className="text-[10px] text-ink-3 font-mono shrink-0">
          Verified by {verifiedBy}
        </span>
      )}
    </div>
  );
});

export default AllergyItem;
