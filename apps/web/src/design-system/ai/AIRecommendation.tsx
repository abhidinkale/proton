import { forwardRef } from 'react';
import { Sparkles, Check, X, Edit2 } from 'lucide-react';

export interface AIRecommendationProps {
  id: string;
  title: string;
  category: string;
  recommendation: string;
  rationale: string;
  evidenceSource?: string;
  confidence?: 'HIGH' | 'MODERATE' | 'LOW';
  onAccept?: () => void;
  onEdit?: () => void;
  onReject?: () => void;
  className?: string;
}

export const AIRecommendation = forwardRef<HTMLDivElement, AIRecommendationProps>(function AIRecommendation(
  {
    title,
    category,
    recommendation,
    rationale,
    evidenceSource,
    confidence = 'HIGH',
    onAccept,
    onEdit,
    onReject,
    className = ''
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={`p-4 rounded-2xl bg-paper border border-accent-line shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-rule">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent-wash text-accent-ink flex items-center justify-center shrink-0">
            <Sparkles size={12} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink">{title}</h4>
            <span className="text-[10px] uppercase font-bold text-ink-3 tracking-wider">{category}</span>
          </div>
        </div>

        <span className={`px-2 py-0.2 rounded-full text-[9px] font-mono font-bold ${
          confidence === 'HIGH' ? 'bg-settled-wash text-settled' : 'bg-caution-wash text-caution'
        }`}>
          {confidence} CONFIDENCE
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-ink leading-relaxed">
          {recommendation}
        </p>
        <p className="text-[11px] text-ink-2 leading-relaxed">
          <strong className="text-ink">Clinical Basis:</strong> {rationale}
        </p>
        {evidenceSource && (
          <p className="text-[10px] text-ink-3 italic">
            Source: {evidenceSource}
          </p>
        )}
      </div>

      <div className="pt-2 border-t border-rule flex items-center justify-between">
        <span className="text-[10px] text-ink-3 font-medium">Physician Action:</span>
        <div className="flex items-center gap-1.5">
          {onReject && (
            <button
              type="button"
              onClick={onReject}
              className="px-2.5 py-1 rounded-full border border-rule text-ink-2 hover:text-critical hover:bg-critical-wash text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X size={11} />
              <span>Dismiss</span>
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="px-2.5 py-1 rounded-full border border-rule text-ink-2 hover:text-ink hover:bg-canvas text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Edit2 size={11} />
              <span>Modify</span>
            </button>
          )}

          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="px-3 py-1 rounded-full bg-solid hover:bg-solid text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Check size={11} />
              <span>Adopt Plan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default AIRecommendation;
