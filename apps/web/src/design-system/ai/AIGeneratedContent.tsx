import { type ReactNode, forwardRef } from 'react';
import { Sparkles, AlertCircle, ExternalLink } from 'lucide-react';

export interface AIGeneratedContentProps {
  children: ReactNode;
  modelIdentifier?: string;
  sourceDocId?: string;
  onViewEvidence?: () => void;
  className?: string;
}

export const AIGeneratedContent = forwardRef<HTMLDivElement, AIGeneratedContentProps>(function AIGeneratedContent(
  {
    children,
    modelIdentifier = 'Proton Specialist AI',
    sourceDocId,
    onViewEvidence,
    className = ''
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-dashed border-accent-line bg-accent-wash/50 p-4 transition-all ${className}`}
    >
      {/* Required Clinical Provenance Header */}
      <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-accent-line/80 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-accent-ink">
          <Sparkles size={13} className="shrink-0 text-accent-ink" />
          <span>AI generated — physician review required</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-ink-2 font-mono">
          <span>{modelIdentifier}</span>
          {sourceDocId && (
            <span className="opacity-70">[{sourceDocId}]</span>
          )}
          {onViewEvidence && (
            <button
              type="button"
              onClick={onViewEvidence}
              className="inline-flex items-center gap-0.5 text-accent-ink hover:underline cursor-pointer font-bold"
            >
              <span>Evidence</span>
              <ExternalLink size={9} />
            </button>
          )}
        </div>
      </div>

      {/* Draft Content Body */}
      <div className="text-xs text-ink leading-relaxed">
        {children}
      </div>

      {/* Non-authoritative Footer Disclaimer */}
      <div className="mt-3 pt-2 border-t border-accent-line/50 flex items-center gap-1.5 text-[10px] text-ink-3">
        <AlertCircle size={10} className="shrink-0" />
        <span>Advisory clinical draft only. Not committed to medical record until physician signs off.</span>
      </div>
    </div>
  );
});

export default AIGeneratedContent;
