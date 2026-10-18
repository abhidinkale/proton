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
      className={`p-4 rounded-2xl bg-white border border-[#FBCFE8] shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#F0ECE1]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center shrink-0">
            <Sparkles size={12} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#151719]">{title}</h4>
            <span className="text-[10px] uppercase font-bold text-[#88909A] tracking-wider">{category}</span>
          </div>
        </div>

        <span className={`px-2 py-0.2 rounded-full text-[9px] font-mono font-bold ${
          confidence === 'HIGH' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF08A] text-[#854D0E]'
        }`}>
          {confidence} CONFIDENCE
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[#151719] leading-relaxed">
          {recommendation}
        </p>
        <p className="text-[11px] text-[#575D65] leading-relaxed">
          <strong className="text-[#151719]">Clinical Basis:</strong> {rationale}
        </p>
        {evidenceSource && (
          <p className="text-[10px] text-[#88909A] italic">
            Source: {evidenceSource}
          </p>
        )}
      </div>

      <div className="pt-2 border-t border-[#F0ECE1] flex items-center justify-between">
        <span className="text-[10px] text-[#88909A] font-medium">Physician Action:</span>
        <div className="flex items-center gap-1.5">
          {onReject && (
            <button
              type="button"
              onClick={onReject}
              className="px-2.5 py-1 rounded-full border border-[#E8E5DC] text-[#575D65] hover:text-[#991B1B] hover:bg-[#FEF2F2] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X size={11} />
              <span>Dismiss</span>
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="px-2.5 py-1 rounded-full border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Edit2 size={11} />
              <span>Modify</span>
            </button>
          )}

          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="px-3 py-1 rounded-full bg-[#151619] hover:bg-[#2A2E37] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
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
